from fastapi import APIRouter

from app.api.v1 import (
    accommodations,
    admin,
    ai,
    auth,
    bookings,
    destinations,
    discovery,
    events,
    favorites,
    gamification,
    meta,
    notifications,
    payments,
    provider,
    recommendations,
    reviews,
    support,
    transportation,
    trips,
    users,
    wallet,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(destinations.router)
api_router.include_router(discovery.router)
api_router.include_router(transportation.router)
api_router.include_router(accommodations.router)
api_router.include_router(bookings.router)
api_router.include_router(payments.router)
api_router.include_router(payments.coupons_router)
api_router.include_router(trips.router)
api_router.include_router(favorites.router)
api_router.include_router(reviews.router)
api_router.include_router(notifications.router)
api_router.include_router(wallet.router)
api_router.include_router(gamification.router)
api_router.include_router(recommendations.router)
api_router.include_router(ai.router)
api_router.include_router(events.router)
api_router.include_router(support.router)
api_router.include_router(admin.router)
api_router.include_router(provider.router)
api_router.include_router(meta.router)
