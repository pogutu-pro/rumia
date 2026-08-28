from app.core.config import settings
from app.core.database import check_database_connection
from app.features.health.schemas import HealthCheckResponse, LivenessCheckResponse


class HealthService:
    @staticmethod
    async def get_health_status() -> HealthCheckResponse:
        db_healthy = await check_database_connection()
        overall_status = "ok" if db_healthy else "degraded"

        return HealthCheckResponse(
            status=overall_status,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            services={
                "database": "connected" if db_healthy else "disconnected",
            },
        )

    @staticmethod
    def get_liveness_status() -> LivenessCheckResponse:
        return LivenessCheckResponse(status="ok")
