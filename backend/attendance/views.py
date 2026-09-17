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
        Reemplaza la planilla de Excel tradicional.
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

        serializer = self.get_serializer(logs, many=True)
        return Response({"year": year, "month": month, "count": logs.count(), "results": serializer.data})

    @action(detail=False, methods=["post"], url_path="facial-checkin")
    def facial_checkin(self, request):
        """
        Endpoint principal: recibe una foto en vivo desde la app (Flutter)
        o la web (React), identifica al empleado por su rostro y determina
        automáticamente si le corresponde ENTRADA o SALIDA según su último
        registro (sin que el usuario tenga que elegir nada).
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