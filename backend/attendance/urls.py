from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, AttendanceLogViewSet, ExportMonthlyAttendanceView

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("attendance", AttendanceLogViewSet, basename="attendance")

urlpatterns = [
    path("attendance/export-monthly/", ExportMonthlyAttendanceView.as_view(), name="attendance-export-monthly"),
] + router.urls