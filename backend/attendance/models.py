from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Employee(models.Model):
    """Empleado registrado en el sistema, con su encoding facial de referencia."""

    class Estado(models.TextChoices):
        ACTIVO = "ACTIVO", "Activo"
        INACTIVO = "INACTIVO", "Inactivo"

    class Sede(models.TextChoices):
        CENTRO = "CENTRO", "Centro"
        NORTE = "NORTE", "Norte"

    document_id = models.CharField("Cédula / Documento", max_length=30, unique=True)
    first_name = models.CharField("Nombres", max_length=100)
    last_name = models.CharField("Apellidos", max_length=100)
    email = models.EmailField(unique=True, null=True, blank=True)
    position = models.CharField("Cargo", max_length=100, blank=True)
    department = models.CharField("Área / Departamento", max_length=100, blank=True)

    sede = models.CharField(
        "Sede",
        max_length=10,
        choices=Sede.choices,
        default=Sede.CENTRO,
    )

    status = models.CharField(
        max_length=10,
        choices=Estado.choices,
        default=Estado.ACTIVO,
    )

    # Foto de referencia usada para generar el encoding
    reference_photo = models.ImageField(
        upload_to="employees/references/",
        null=True,
        blank=True
    )

    # Encoding facial
    face_encoding = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.document_id})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def has_face_registered(self):
        return bool(self.face_encoding)

    @property
    def last_attendance_log(self):
        """El registro de bitácora más reciente de este empleado, o None si nunca ha marcado."""
        return self.attendance_logs.order_by("-timestamp").first()

    @property
    def current_status(self):
        """
        'ADENTRO' si su última marcación fue ENTRADA (sigue laborando),
        'AFUERA' si fue SALIDA o si nunca ha marcado nada.
        """
        last = self.last_attendance_log
        if last is None or last.log_type == AttendanceLog.Tipo.SALIDA:
            return "AFUERA"
        return "ADENTRO"


class AttendanceLog(models.Model):
    """Registro individual de la bitácora mensual de ingreso/salida."""

    class Tipo(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada"
        SALIDA = "SALIDA", "Salida"

    class Metodo(models.TextChoices):
        FACIAL = "FACIAL", "Reconocimiento facial"
        MANUAL = "MANUAL", "Registro manual"

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="attendance_logs"
    )
    log_type = models.CharField(max_length=10, choices=Tipo.choices)
    method = models.CharField(max_length=10, choices=Metodo.choices, default=Metodo.FACIAL)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Evidencia fotográfica del momento del check-in/out
    capture_photo = models.ImageField(upload_to="attendance/captures/", null=True, blank=True)

    # Qué tan segura fue la coincidencia facial (0 a 1). Útil para auditoría.
    match_confidence = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )

    notes = models.CharField("Observaciones", max_length=255, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["employee", "timestamp"]),
            models.Index(fields=["log_type", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.log_type} - {self.timestamp:%Y-%m-%d %H:%M}"
