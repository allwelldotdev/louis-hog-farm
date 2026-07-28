from fastapi import APIRouter

from app.api.v1.endpoints import (
    alert_rules,
    alerts,
    auth,
    breeding_cycles,
    dashboard,
    exports,
    feed_records,
    health_records,
    hogs,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(hogs.router)
api_router.include_router(feed_records.router)
api_router.include_router(health_records.router)
api_router.include_router(breeding_cycles.router)
api_router.include_router(alert_rules.router)
api_router.include_router(alerts.router)
api_router.include_router(dashboard.router)
api_router.include_router(exports.router)
