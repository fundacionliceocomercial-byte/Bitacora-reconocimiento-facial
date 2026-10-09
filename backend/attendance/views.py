from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
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
from .services.export import (
    build_monthly_excel,
    build_monthly_pdf,
    build_roll_call_excel,
    build_roll_call_pdf,
)


# Horario oficial de referencia. Zona horaria configurada en Django.
HORA_ENTRADA_OFICIAL = time(8, 0)
HORA_SALIDA_OFICIAL = time(17, 0)


def _format_remaining(seconds):
    seconds = max(int(seconds), 0)
    minutes, secs = divmod(seconds, 60)

    if minutes > 0:
        return f"{minutes} min {secs} seg" if secs else f"{minutes} min"

    return f"{secs} seg"


class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD de empleados y registro de rostro de referencia."""

    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "first_name",
        "last_name",
        "document_id",
        "department",
    ]

    @action(detail=True, methods=["post"], url_path="enroll-face")
    def enroll_face(self, request, pk=None):
        """Registra o reemplaza la foto y la codificación facial."""

        employee = self.get_object()
        serializer = EmployeeFaceEnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = serializer.validated_data["photo"]

        try:
            encoding = extract_encoding(photo)
        except NoFaceDetectedError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MultipleFacesDetectedError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        photo.seek(0)
        employee.reference_photo = photo
        employee.face_encoding = encoding
        employee.save(
            update_fields=[
                "reference_photo",
                "face_encoding",
                "updated_at",
            ]
        )

        return Response(
            {
                "detail": "Rostro registrado correctamente.",
                "employee": EmployeeSerializer(employee).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="inside")
    def inside(self, request):
        """
        Lista de empleados que, según su última marcación, están
        actualmente ADENTRO. Pensada para llamados a lista en caso de
        emergencia (ej. evacuación por desastre natural), por eso NO
        pagina: siempre devuelve el listado completo.

        GET /api/employees/inside/?sede=CENTRO|NORTE
        """
        sede = request.query_params.get("sede", "").strip().upper()

        if sede and sede not in ("CENTRO", "NORTE"):
            return Response(
                {"detail": "La sede debe ser CENTRO o NORTE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = Employee.objects.filter(status="ACTIVO")

        if sede:
            employees = employees.filter(sede=sede)

        inside = [emp for emp in employees if emp.current_status == "ADENTRO"]
        inside.sort(key=lambda emp: emp.full_name.casefold())

        serializer = EmployeeSerializer(inside, many=True)

        return Response(
            {
                "sede": sede or None,
                "count": len(inside),
                "results": serializer.data,
            }
        )

    @action(detail=False, methods=["get"], url_path="export-inside")
    def export_inside(self, request):
        """
        Exporta a Excel o PDF la lista de empleados actualmente ADENTRO,
        para llamado a lista en caso de emergencia.

        GET /api/employees/export-inside/?sede=CENTRO|NORTE&file_format=xlsx|pdf
        """
        sede = request.query_params.get("sede", "").strip().upper()

        if sede and sede not in ("CENTRO", "NORTE"):
            return Response(
                {"detail": "La sede debe ser CENTRO o NORTE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_format = request.query_params.get("file_format", "xlsx").lower()

        if file_format not in ("xlsx", "pdf"):
            return Response(
                {"detail": "El formato debe ser 'xlsx' o 'pdf'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = Employee.objects.filter(status="ACTIVO")

        if sede:
            employees = employees.filter(sede=sede)

        inside = [emp for emp in employees if emp.current_status == "ADENTRO"]
        inside.sort(key=lambda emp: emp.full_name.casefold())

        filename = "lista_evacuacion" + (f"_{sede.lower()}" if sede else "")

        if file_format == "pdf":
            content = build_roll_call_pdf(inside, sede=sede)
            response = HttpResponse(content, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
            return response

        content = build_roll_call_excel(inside, sede=sede)
        response = HttpResponse(
            content,
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
        return response


class AttendanceLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de la bitácora.
    Incluye resumen, reporte general, bitácora mensual,
    observaciones y check-in facial.
    """

    queryset = AttendanceLog.objects.select_related("employee").all()
    serializer_class = AttendanceLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["employee", "log_type", "method"]
    ordering_fields = ["timestamp"]

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Resumen estadístico del período consultado."""

        today = timezone.localdate()
        first_day = today.replace(day=1)

        start_param = request.query_params.get("start_date")
        end_param = request.query_params.get("end_date")
        sede = request.query_params.get("sede", "").strip().upper()

        try:
            start_date = (
                date.fromisoformat(start_param)
                if start_param
                else first_day
            )
            end_date = (
                date.fromisoformat(end_param)
                if end_param
                else today
            )
        except (TypeError, ValueError):
            return Response(
                {"detail": "Las fechas deben tener el formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if start_date > end_date:
            return Response(
                {"detail": "La fecha inicial no puede ser posterior a la fecha final."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if end_date > today:
            return Response(
                {"detail": "La fecha final no puede ser posterior a hoy."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if sede and sede not in ("CENTRO", "NORTE"):
            return Response(
                {"detail": "La sede debe ser CENTRO o NORTE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = Employee.objects.all()

        logs = self.get_queryset().filter(
            timestamp__date__gte=start_date,
            timestamp__date__lte=end_date,
        )

        if sede:
            employees = employees.filter(sede=sede)
            logs = logs.filter(employee__sede=sede)

        active_employees = employees.filter(status="ACTIVO").count()
        inactive_employees = employees.filter(status="INACTIVO").count()

        total_entries = logs.filter(log_type="ENTRADA").count()
        total_exits = logs.filter(log_type="SALIDA").count()

        facial_logs = logs.filter(method="FACIAL").count()
        manual_logs = logs.filter(method="MANUAL").count()

        daily_data = (
            logs.annotate(
                day=TruncDate(
                    "timestamp",
                    tzinfo=timezone.get_current_timezone(),
                )
            )
            .values("day")
            .annotate(
                entries=Count("id", filter=Q(log_type="ENTRADA")),
                exits=Count("id", filter=Q(log_type="SALIDA")),
            )
            .order_by("day")
        )

        daily = [
            {
                "date": item["day"].isoformat(),
                "entries": item["entries"],
                "exits": item["exits"],
            }
            for item in daily_data
            if item["day"] is not None
        ]

        sede_data = (
            logs.values("employee__sede")
            .annotate(total=Count("id"))
            .order_by("employee__sede")
        )

        by_sede = [
            {
                "sede": item["employee__sede"],
                "total": item["total"],
            }
            for item in sede_data
        ]

        return Response(
            {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "sede": sede or None,
                "employees": {
                    "active": active_employees,
                    "inactive": inactive_employees,
                    "total": active_employees + inactive_employees,
                },
                "attendance": {
                    "entries": total_entries,
                    "exits": total_exits,
                    "total": total_entries + total_exits,
                },
                "methods": {
                    "facial": facial_logs,
                    "manual": manual_logs,
                },
                "daily": daily,
                "by_sede": by_sede,
            }
        )

    @action(detail=False, methods=["get"], url_path="general-report")
    def general_report(self, request):
        """
        Reporte general de asistencia.

        GET /api/attendance/general-report/
        Parámetros:
        start_date=YYYY-MM-DD
        end_date=YYYY-MM-DD
        sede=CENTRO|NORTE
        employee=ID del empleado

        Devuelve una fila por empleado y día con las marcaciones
        combinadas, estado de jornada y referencias horarias.
        """

        today = timezone.localdate()
        first_day = today.replace(day=1)

        start_param = request.query_params.get("start_date")
        end_param = request.query_params.get("end_date")
        sede = request.query_params.get("sede", "").strip().upper()
        employee_param = request.query_params.get("employee", "").strip()

        try:
            start_date = (
                date.fromisoformat(start_param)
                if start_param
                else first_day
            )
            end_date = (
                date.fromisoformat(end_param)
                if end_param
                else today
            )
        except (TypeError, ValueError):
            return Response(
                {"detail": "Las fechas deben tener el formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if start_date > end_date:
            return Response(
                {"detail": "La fecha inicial no puede ser posterior a la fecha final."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if end_date > today:
            return Response(
                {"detail": "La fecha final no puede ser posterior a hoy."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if sede and sede not in ("CENTRO", "NORTE"):
            return Response(
                {"detail": "La sede debe ser CENTRO o NORTE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = Employee.objects.all()

        if sede:
            employees = employees.filter(sede=sede)

        if employee_param:
            try:
                employees = employees.filter(pk=int(employee_param))
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El identificador del empleado no es válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        logs = (
            AttendanceLog.objects
            .select_related("employee")
            .filter(
                timestamp__date__gte=start_date,
                timestamp__date__lte=end_date,
                employee__in=employees,
            )
            .order_by("employee_id", "timestamp", "id")
        )

        grouped = {}

        for log in logs:
            local_timestamp = timezone.localtime(log.timestamp)
            local_day = local_timestamp.date()
            key = (log.employee_id, local_day)

            if key not in grouped:
                grouped[key] = {
                    "employee": log.employee_id,
                    "employee_name": log.employee.full_name,
                    "document_id": log.employee.document_id,
                    "department": log.employee.department,
                    "sede": log.employee.sede,
                    "date": local_day.isoformat(),
                    "entrada_time": None,
                    "salida_time": None,
                    "entrada_method": None,
                    "salida_method": None,
                    "entrada_log_id": None,
                    "salida_log_id": None,
                    "notes": [],
                    "_has_entry": False,
                    "_has_exit": False,
                }

            row = grouped[key]

            if log.log_type == "ENTRADA":
                # Conservamos la primera entrada registrada del día.
                if not row["_has_entry"]:
                    row["entrada_time"] = local_timestamp
                    row["entrada_method"] = log.method
                    row["entrada_log_id"] = log.id
                row["_has_entry"] = True

            elif log.log_type == "SALIDA":
                # Conservamos la última salida registrada del día.
                row["salida_time"] = local_timestamp
                row["salida_method"] = log.method
                row["salida_log_id"] = log.id
                row["_has_exit"] = True

            if log.notes:
                row["notes"].append(log.notes)

        now_local = timezone.localtime(timezone.now())
        current_time = now_local.time().replace(tzinfo=None)

        results = []

        for row in grouped.values():
            row_day = date.fromisoformat(row["date"])
            has_entry = row.pop("_has_entry")
            has_exit = row.pop("_has_exit")

            if has_entry and has_exit:
                attendance_status = "COMPLETA"
            elif has_exit and not has_entry:
                attendance_status = "SALIDA_SIN_ENTRADA"
            elif has_entry and not has_exit:
                if row_day < today or (
                    row_day == today
                    and current_time >= HORA_SALIDA_OFICIAL
                ):
                    attendance_status = "PENDIENTE_SALIDA"
                else:
                    attendance_status = "JORNADA_EN_CURSO"
            else:
                attendance_status = "SIN_MARCADAS"

            entrada = row["entrada_time"]
            salida = row["salida_time"]

            row["entrada_time"] = (
                entrada.strftime("%H:%M:%S") if entrada else None
            )
            row["salida_time"] = (
                salida.strftime("%H:%M:%S") if salida else None
            )

            row["entrada_tardia"] = bool(
                entrada
                and entrada.time().replace(tzinfo=None) > HORA_ENTRADA_OFICIAL
            )
            row["salida_anticipada"] = bool(
                salida
                and salida.time().replace(tzinfo=None) < HORA_SALIDA_OFICIAL
            )

            row["status"] = attendance_status
            row["notes"] = "; ".join(dict.fromkeys(row["notes"]))

            results.append(row)

        # Orden: fecha descendente (más reciente arriba), y dentro del
        # mismo día, nombre ascendente (A→Z). Se hace en dos pasadas con
        # sort() estable: primero por nombre (ascendente), y luego por
        # fecha (descendente) — así la segunda pasada no revuelve el
        # orden por nombre que ya quedó armado dentro de cada fecha.
        # (Un solo sort(..., reverse=True) sobre la tupla completa
        # invertiría también el nombre, dejándolo de Z a A por error.)
        results.sort(key=lambda item: item["employee_name"].casefold())
        results.sort(key=lambda item: item["date"], reverse=True)

        total_entries = sum(
            1 for row in results if row["entrada_time"] is not None
        )
        total_exits = sum(
            1 for row in results if row["salida_time"] is not None
        )
        complete_days = sum(
            1 for row in results if row["status"] == "COMPLETA"
        )
        pending_exits = sum(
            1 for row in results if row["status"] == "PENDIENTE_SALIDA"
        )
        missing_entries = sum(
            1 for row in results if row["status"] == "SALIDA_SIN_ENTRADA"
        )
        ongoing_days = sum(
            1 for row in results if row["status"] == "JORNADA_EN_CURSO"
        )

        return Response(
            {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "sede": sede or None,
                "employee": employee_param or None,
                "schedule": {
                    "entry_time": HORA_ENTRADA_OFICIAL.strftime("%H:%M"),
                    "exit_time": HORA_SALIDA_OFICIAL.strftime("%H:%M"),
                },
                "summary": {
                    "days_with_records": len(results),
                    "entries": total_entries,
                    "exits": total_exits,
                    "complete_days": complete_days,
                    "pending_exits": pending_exits,
                    "exits_without_entry": missing_entries,
                    "ongoing_days": ongoing_days,
                },
                "count": len(results),
                "results": results,
            }
        )

    @action(detail=False, methods=["get"], url_path="monthly")
    def monthly(self, request):
        """Bitácora mensual agrupada por empleado y día."""

        today = timezone.now()

        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            return Response(
                {"detail": "El año y el mes deben ser valores numéricos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month < 1 or month > 12:
            return Response(
                {"detail": "El mes debe estar entre 1 y 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logs = self.get_queryset().filter(
            timestamp__year=year,
            timestamp__month=month,
        )

        employee_id = request.query_params.get("employee")
        if employee_id:
            logs = logs.filter(employee_id=employee_id)

        day_param = request.query_params.get("day")
        if day_param:
            try:
                selected_day = date.fromisoformat(day_param)
            except ValueError:
                return Response(
                    {"detail": "El día debe tener el formato YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if selected_day.year != year or selected_day.month != month:
                return Response(
                    {"detail": "El día seleccionado no pertenece al año y mes consultados."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logs = logs.filter(timestamp__date=selected_day)

        sede_param = request.query_params.get("sede")
        if sede_param:
            sede_param = sede_param.upper()

            if sede_param not in ("CENTRO", "NORTE"):
                return Response(
                    {"detail": "La sede debe ser CENTRO o NORTE."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logs = logs.filter(employee__sede=sede_param)

        logs = logs.order_by("employee_id", "timestamp")

        grouped = {}

        for log in logs:
            local_day = timezone.localtime(log.timestamp).date()
            key = (log.employee_id, local_day)

            if key not in grouped:
                grouped[key] = {
                    "employee": log.employee_id,
                    "employee_name": log.employee.full_name,
                    "sede": log.employee.sede,
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
                    "notes_log_id": None,
                }

            row = grouped[key]

            if log.log_type == "ENTRADA":
                # Igual que en general_report: nos quedamos con la
                # PRIMERA entrada del día, no con la última.
                if row["entrada_time"] is None:
                    row["entrada_time"] = log.timestamp
                    row["entrada_method"] = log.method
                    row["entrada_confidence"] = log.match_confidence
                    row["entrada_log_id"] = log.id
            else:
                # La salida sí se queda con la última del día.
                row["salida_time"] = log.timestamp
                row["salida_method"] = log.method
                row["salida_confidence"] = log.match_confidence
                row["salida_log_id"] = log.id

            if log.notes:
                row["notes"] = log.notes
                row["notes_log_id"] = log.id

        def sort_key(row):
            row_date = date.fromisoformat(row["date"])
            entrada_key = (
                -row["entrada_time"].timestamp()
                if row["entrada_time"]
                else float("inf")
            )
            return (-row_date.toordinal(), entrada_key)

        all_results = sorted(grouped.values(), key=sort_key)
        total_count = len(all_results)

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = max(int(request.query_params.get("page_size", 31)), 1)
        except (TypeError, ValueError):
            page, page_size = 1, 31

        start = (page - 1) * page_size
        end = start + page_size
        page_results = all_results[start:end]

        return Response(
            {
                "year": year,
                "month": month,
                "day": day_param,
                "sede": sede_param,
                "count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (
                    (total_count + page_size - 1) // page_size
                    if page_size
                    else 1
                ),
                "results": page_results,
            }
        )

    @action(detail=True, methods=["patch"], url_path="notes")
    def update_notes(self, request, pk=None):
        """Actualiza la observación de una marcación puntual."""

        log = self.get_object()

        serializer = self.get_serializer(
            log,
            data={"notes": request.data.get("notes", "")},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="facial-checkin")
    def facial_checkin(self, request):
        """Identifica al empleado y alterna entre entrada y salida."""

        serializer = FacialCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo = serializer.validated_data["photo"]

        try:
            match = find_matching_employee(photo)
        except NoFaceDetectedError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MultipleFacesDetectedError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if match.employee is None:
            return Response(
                {
                    "detail": (
                        "No se reconoció al empleado. Verifica que esté "
                        "registrado o intenta de nuevo con mejor luz."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        last_log = match.employee.last_attendance_log

        if last_log is not None:
            elapsed = (
                timezone.now() - last_log.timestamp
            ).total_seconds()
            cooldown_seconds = settings.CHECKIN_COOLDOWN_MINUTES * 60

            if elapsed < cooldown_seconds:
                remaining = _format_remaining(
                    cooldown_seconds - elapsed
                )
                return Response(
                    {
                        "detail": (
                            "Ya registraste tu marcación hace instantes. "
                            f"Espera {remaining} para volver a marcar."
                        )
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        log_type = (
            "ENTRADA"
            if last_log is None or last_log.log_type == "SALIDA"
            else "SALIDA"
        )

        photo.seek(0)
        log = AttendanceLog.objects.create(
            employee=match.employee,
            log_type=log_type,
            method="FACIAL",
            capture_photo=photo,
            match_confidence=round(match.confidence, 4),
        )

        return Response(
            {
                "detail": (
                    f"{log_type.title()} registrada para "
                    f"{match.employee.full_name}."
                ),
                "log": AttendanceLogSerializer(log).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ExportMonthlyAttendanceView(APIView):
    """Exporta la bitácora mensual en Excel o PDF."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now()

        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            return Response(
                {"detail": "El año y el mes deben ser valores numéricos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_format = request.query_params.get("file_format", "xlsx").lower()

        if month < 1 or month > 12:
            return Response(
                {"detail": "El mes debe estar entre 1 y 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_format not in ("xlsx", "pdf"):
            return Response(
                {"detail": "El formato debe ser 'xlsx' o 'pdf'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logs = AttendanceLog.objects.select_related("employee").filter(
            timestamp__year=year,
            timestamp__month=month,
        )

        employee_id = request.query_params.get("employee")
        if employee_id:
            logs = logs.filter(employee_id=employee_id)

        day = request.query_params.get("day")
        if day:
            try:
                selected_day = date.fromisoformat(day)
            except ValueError:
                return Response(
                    {"detail": "El día debe tener el formato YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if selected_day.year != year or selected_day.month != month:
                return Response(
                    {"detail": "El día seleccionado no pertenece al año y mes de la exportación."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logs = logs.filter(timestamp__date=selected_day)

        sede = request.query_params.get("sede")
        if sede:
            sede = sede.upper()

            if sede not in ("CENTRO", "NORTE"):
                return Response(
                    {"detail": "La sede debe ser 'CENTRO' o 'NORTE'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logs = logs.filter(employee__sede=sede)

        logs = logs.order_by("employee_id", "timestamp")
        filename = f"bitacora_{year}_{month:02d}"

        if file_format == "pdf":
            content = build_monthly_pdf(
                logs,
                year,
                month,
                sede=sede,
                day=day,
            )

            response = HttpResponse(
                content,
                content_type="application/pdf",
            )
            response["Content-Disposition"] = (
                f'attachment; filename="{filename}.pdf"'
            )
            return response

        content = build_monthly_excel(
            logs,
            year,
            month,
            sede=sede,
            day=day,
        )

        response = HttpResponse(
            content,
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{filename}.xlsx"'
        )
        return response