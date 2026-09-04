from fastapi import APIRouter, status
from app.features.health.schemas import HealthCheckResponse, LivenessCheckResponse
from app.features.health.service import HealthService

router = APIRouter(prefix="/health", tags=["Health Checks"])


@router.get(
    "",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Full System Health Check",
    description="Returns overall system status, environment configuration, and database connection status.",
)
async def health_check() -> HealthCheckResponse:
    return await HealthService.get_health_status()


@router.get(
    "/liveness",
    response_model=LivenessCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description="Fast liveness check for container orchestration and reverse proxies.",
)
def liveness_check() -> LivenessCheckResponse:
    return HealthService.get_liveness_status()
