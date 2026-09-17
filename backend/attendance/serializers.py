from rest_framework import serializers
from .models import Employee, AttendanceLog


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    has_face_registered = serializers.ReadOnlyField()
    current_status = serializers.ReadOnlyField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "document_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "position",
            "department",
            "sede",
            "status",
            "reference_photo",
            "has_face_registered",
            "current_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_email(self, value):
        """
        Convierte un correo vacío en NULL para evitar
        conflictos con unique=True en PostgreSQL.
        """
        if value == "":
            return None
        return value


class EmployeeFaceEnrollSerializer(serializers.Serializer):
    """Serializer solo para el endpoint de registro/actualización de rostro."""
    photo = serializers.ImageField()


class AttendanceLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True
    )

    employee_document = serializers.CharField(
        source="employee.document_id",
        read_only=True
    )

    class Meta:
        model = AttendanceLog
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_document",
            "log_type",
            "method",
            "timestamp",
            "capture_photo",
            "match_confidence",
            "notes",
        ]
        read_only_fields = ["timestamp"]


class FacialCheckInSerializer(serializers.Serializer):
    """Payload que envían React/Flutter: solo la foto. El tipo (ENTRADA/SALIDA) lo determina el backend automáticamente."""
    photo = serializers.ImageField()