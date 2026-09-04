from fastapi import APIRouter
from app.features.admin import admin_router
from app.features.agents import agents_router
from app.features.analytics import analytics_router
from app.features.announcements import announcements_router
from app.features.campuses import campuses_router
from app.features.feedback import feedback_router
from app.features.health import health_router
from app.features.hostel_requests import hostel_requests_router
from app.features.images import images_router
from app.features.leads import leads_router
from app.features.legal import legal_router
from app.features.listings import listings_router
from app.features.notifications import notifications_router
from app.features.profiles import profiles_router
from app.features.regions import regions_router
from app.features.reviews import reviews_router
from app.features.search import search_router
from app.features.tours import tours_router
from app.features.zones import zones_router

api_router = APIRouter()

# Register vertical feature slice routers
api_router.include_router(health_router)
api_router.include_router(analytics_router)
api_router.include_router(campuses_router)
api_router.include_router(zones_router)
api_router.include_router(hostel_requests_router)
api_router.include_router(listings_router)
api_router.include_router(regions_router)
api_router.include_router(search_router)
api_router.include_router(reviews_router)
api_router.include_router(agents_router)
api_router.include_router(feedback_router)
api_router.include_router(profiles_router)
api_router.include_router(tours_router)
api_router.include_router(leads_router)
api_router.include_router(notifications_router)
api_router.include_router(legal_router)
api_router.include_router(announcements_router)
api_router.include_router(admin_router)
api_router.include_router(images_router)








