from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, AttendanceLogViewSet

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("attendance", AttendanceLogViewSet, basename="attendance")

urlpatterns = router.urls
