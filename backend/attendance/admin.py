from django.contrib import admin
from .models import Employee, AttendanceLog


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("full_name", "document_id", "department", "position", "status", "has_face_registered")
    list_filter = ("status", "department")
    search_fields = ("first_name", "last_name", "document_id", "email")


@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ("employee", "log_type", "method", "timestamp", "match_confidence")
    list_filter = ("log_type", "method", "timestamp")
    search_fields = ("employee__first_name", "employee__last_name", "employee__document_id")
    date_hierarchy = "timestamp"
