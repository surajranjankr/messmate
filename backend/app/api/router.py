from fastapi import APIRouter
from app.api.routes import (
    auth,
    users,
    menus,
    meals,
    responses,
    notifications,
    schedules,
    forecasts,
    outcomes,
    reports,
    settings,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(menus.router)
api_router.include_router(meals.router)
api_router.include_router(responses.router)
api_router.include_router(notifications.router)
api_router.include_router(schedules.router)
api_router.include_router(forecasts.router)
api_router.include_router(outcomes.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
