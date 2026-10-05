from datetime import date

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Employee, AttendanceLog
from .serializers import (
    EmployeeSerializer,
    EmployeeFaceEnrollSerializer,
    AttendanceLogSerializer,
    FacialCheckInSerializer,
)
from .services.facial_recognition import (
    extract_encoding,
    find_matching_employee,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
)
from .services.export import build_monthly_excel, build_monthly_pdf


def _format_remaining(seconds):
    seconds = max(int(seconds), 0)
    minutes, secs = divmod(seconds, 60)
    if minutes > 0:
        return f"{minutes} min {secs} seg" if secs else f"{minutes} min"
    return f"{secs} seg"


class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD de empleados + endpoint para enrolar/actualizar su rostro de referencia."""

    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name", "document_id", "department"]

    @action(detail=True, methods=["post"], url_path="enroll-face")
    def enroll_face(self, request, pk=None):
        """
        Sube (o reemplaza) la foto de referencia de un empleado y genera
        su encoding facial. Se usa una sola vez al dar de alta al empleado.
        """
        employee = self.get_object()
        serializer = EmployeeFaceEnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = serializer.validated_data["photo"]

        try:
            encoding = extract_encoding(photo)
        except NoFaceDetectedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except MultipleFacesDetectedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        photo.seek(0)
        employee.reference_photo = photo
        employee.face_encoding = encoding
        employee.save(update_fields=["reference_photo", "face_encoding", "updated_at"])

        return Response(
            {"detail": "Rostro registrado correctamente.", "employee": EmployeeSerializer(employee).data},
            status=status.HTTP_200_OK,
        )


class AttendanceLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de la bitácora (solo lectura vía API general; los registros
    se crean únicamente a través del endpoint de check-in facial o manual).
    La única escritura permitida aquí es la observación (ver update_notes).
    """

    queryset = AttendanceLog.objects.select_related("employee").all()
    serializer_class = AttendanceLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "log_type", "method"]
    ordering_fields = ["timestamp"]

    @action(detail=False, methods=["get"], url_path="monthly")
    def monthly(self, request):
        """
        Bitácora mensual: /api/attendance/monthly/?year=2026&month=9
        Opcional: &day=2026-09-30 (filtra a un solo día dentro del mes)
        Opcional: &page=1&page_size=31 (paginación manual)

        Devuelve 1 registro por empleado/día, combinando su ENTRADA y
        SALIDA de esa fecha en la misma fila. Orden: fecha descendente
        (más reciente primero), y dentro de un mismo día, por hora de
        entrada descendente (quien llegó más tarde, arriba).
        """
        today = timezone.now()
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))

        logs = self.get_queryset().filter(
            timestamp__year=year, timestamp__month=month
        )

        employee_id = request.query_params.get("employee")
        if employee_id:
            logs = logs.filter(employee_id=employee_id)

        day_param = request.query_params.get("day")
        if day_param:
            logs = logs.filter(timestamp__date=day_param)

        logs = logs.order_by("employee_id", "timestamp")

        grouped = {}
        for log in logs:
            local_day = timezone.localtime(log.timestamp).date()
            key = (log.employee_id, local_day)

            if key not in grouped:
                grouped[key] = {
                    "employee": log.employee_id,
                    "employee_name": log.employee.full_name,
                    "date": local_day.isoformat(),
                    "entrada_time": None,
                    "entrada_method": None,
                    "entrada_confidence": None,
                    "entrada_log_id": None,
                    "salida_time": None,
                    "salida_method": None,
                    "salida_confidence": None,
                    "salida_log_id": None,
                    "notes": "",
                }

            row = grouped[key]
            if log.log_type == AttendanceLog.Tipo.ENTRADA:
                row["entrada_time"] = log.timestamp
                row["entrada_method"] = log.method
                row["entrada_confidence"] = log.match_confidence
                row["entrada_log_id"] = log.id
            else:
                row["salida_time"] = log.timestamp
                row["salida_method"] = log.method
                row["salida_confidence"] = log.match_confidence
                row["salida_log_id"] = log.id

            # Si cualquiera de los dos registros del día trae observación,
            # se muestra (lo normal es que la deje el empleado en uno solo).
            if log.notes:
                row["notes"] = log.notes

        def sort_key(row):
            row_date = date.fromisoformat(row["date"])
            entrada_key = -row["entrada_time"].timestamp() if row["entrada_time"] else float("inf")
            return (-row_date.toordinal(), entrada_key)

        all_results = sorted(grouped.values(), key=sort_key)

        total_count = len(all_results)

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = max(int(request.query_params.get("page_size", 31)), 1)
        except ValueError:
            page, page_size = 1, 31

        start = (page - 1) * page_size
        end = start + page_size
        page_results = all_results[start:end]

        return Response(
            {
                "year": year,
                "month": month,
                "day": day_param,
                "count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size if page_size else 1,
                "results": page_results,
            }
        )

    @action(detail=True, methods=["patch"], url_path="notes")
    def update_notes(self, request, pk=None):
        """
        Actualiza únicamente la observación de un registro puntual.
        Lo usa tanto la app móvil (justo después de marcar) como la
        bitácora web (al editar la columna de Observaciones).
        PATCH /api/attendance/{id}/notes/  body: {"notes": "..."}
        """
        log = self.get_object()
        serializer = self.get_serializer(log, data={"notes": request.data.get("notes", "")}, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="facial-checkin")
    def facial_checkin(self, request):
        """
        Endpoint principal: recibe una foto en vivo desde la app (Flutter)
        o la web (React), identifica al empleado por su rostro y determina
        automáticamente si le corresponde ENTRADA o SALIDA según su último
        registro (sin que el usuario tenga que elegir nada).

        Antes de crear el registro, aplica un cooldown: si el empleado ya
        marcó hace menos de CHECKIN_COOLDOWN_MINUTES, se rechaza para
        evitar una doble marcación accidental (ej. quedarse frente a la
        cámara y que detecte el rostro dos veces).
        """
        serializer = FacialCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = serializer.validated_data["photo"]

        try:
            match = find_matching_employee(photo)
        except NoFaceDetectedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except MultipleFacesDetectedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if match.employee is None:
            return Response(
                {"detail": "No se reconoció al empleado. Verifica que esté registrado o intenta de nuevo con mejor luz."},
                status=status.HTTP_404_NOT_FOUND,
            )

        last_log = match.employee.last_attendance_log

        if last_log is not None:
            elapsed = (timezone.now() - last_log.timestamp).total_seconds()
            cooldown_seconds = settings.CHECKIN_COOLDOWN_MINUTES * 60
            if elapsed < cooldown_seconds:
                remaining = _format_remaining(cooldown_seconds - elapsed)
                return Response(
                    {
                        "detail": f"Ya registraste tu marcación hace instantes. "
                                  f"Espera {remaining} para volver a marcar.",
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        log_type = (
            AttendanceLog.Tipo.ENTRADA
            if last_log is None or last_log.log_type == AttendanceLog.Tipo.SALIDA
            else AttendanceLog.Tipo.SALIDA
        )

        photo.seek(0)
        log = AttendanceLog.objects.create(
            employee=match.employee,
            log_type=log_type,
            method=AttendanceLog.Metodo.FACIAL,
            capture_photo=photo,
            match_confidence=round(match.confidence, 4),
        )

        return Response(
            {
                "detail": f"{log_type.title()} registrada para {match.employee.full_name}.",
                "log": AttendanceLogSerializer(log).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ExportMonthlyAttendanceView(APIView):
    """
    Vista independiente (no un @action del router) para evitar cualquier
    ambigüedad de enrutamiento con la ruta de detalle /attendance/{id}/.
    GET /api/attendance/export-monthly/?year=2026&month=9&format=xlsx
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now()
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))
        file_format = request.query_params.get("format", "xlsx").lower()

        logs = AttendanceLog.objects.select_related("employee").filter(
            timestamp__year=year, timestamp__month=month
        )
        employee_id = request.query_params.get("employee")
        if employee_id:
            logs = logs.filter(employee_id=employee_id)
        logs = logs.order_by("timestamp")

        filename = f"bitacora_{year}_{month:02d}"

        if file_format == "pdf":
            content = build_monthly_pdf(logs, year, month)
            response = HttpResponse(content, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
            return response

        content = build_monthly_excel(logs, year, month)
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
        return response