from fastapi import APIRouter
from app.features.campuses import campuses_router
from app.features.health import health_router
from app.features.listings import listings_router
from app.features.zones import zones_router

api_router = APIRouter()

# Register vertical feature slice routers
api_router.include_router(health_router)
api_router.include_router(campuses_router)
api_router.include_router(zones_router)
api_router.include_router(listings_router)
