from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    TRAVELER = "traveler"
    PROVIDER = "provider"
    CONTENT_MANAGER = "content_manager"
    SUPPORT_AGENT = "support_agent"
    MARKETING_MANAGER = "marketing_manager"
    ADMIN = "admin"


class TransportType(StrEnum):
    FLIGHT = "flight"
    TRAIN = "train"
    BUS = "bus"
    CAR = "car"
    TAXI = "taxi"
    RIDE_HAILING = "ride_hailing"
    RENTAL_CAR = "rental_car"
    MIXED = "mixed"


class AccommodationType(StrEnum):
    HOTEL = "hotel"
    APARTHOTEL = "aparthotel"
    HOSTEL = "hostel"
    VILLA = "villa"
    ECO_LODGE = "eco_lodge"
    APARTMENT = "apartment"
    CAMP = "camp"
    HERITAGE = "heritage"


class AttractionCategory(StrEnum):
    HISTORICAL = "historical"
    NATURAL = "natural"
    CULTURAL = "cultural"
    ENTERTAINMENT = "entertainment"
    RELIGIOUS = "religious"
    SHOPPING = "shopping"
    MUSEUM = "museum"
    HIDDEN_GEM = "hidden_gem"


class ExperienceCategory(StrEnum):
    CITY_TOUR = "city_tour"
    FOOD_TOUR = "food_tour"
    COOKING = "cooking"
    HANDICRAFT = "handicraft"
    NATURE = "nature"
    HIKING = "hiking"
    CYCLING = "cycling"
    PHOTOGRAPHY = "photography"
    ADVENTURE = "adventure"
    LOCAL_LIFE = "local_life"


class BookingType(StrEnum):
    TRANSPORT = "transport"
    ACCOMMODATION = "accommodation"
    EXPERIENCE = "experience"


class BookingStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    REFUNDED = "refunded"


class PaymentMethod(StrEnum):
    CARD = "card"
    WALLET = "wallet"
    CASH = "cash"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class TripStatus(StrEnum):
    DRAFT = "draft"
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TripActivityType(StrEnum):
    TRANSPORT = "transport"
    CHECK_IN = "check_in"
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    EXPERIENCE = "experience"
    FREE_TIME = "free_time"
    NOTE = "note"


class ReviewEntity(StrEnum):
    DESTINATION = "destination"
    ACCOMMODATION = "accommodation"
    TRANSPORT = "transport"
    RESTAURANT = "restaurant"
    ATTRACTION = "attraction"
    EXPERIENCE = "experience"


class ReviewStatus(StrEnum):
    PENDING = "pending"
    PUBLISHED = "published"
    REJECTED = "rejected"


class FavoriteEntity(StrEnum):
    DESTINATION = "destination"
    ACCOMMODATION = "accommodation"
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    EXPERIENCE = "experience"


class NotificationType(StrEnum):
    BOOKING = "booking"
    PAYMENT = "payment"
    TRIP_REMINDER = "trip_reminder"
    PRICE_DROP = "price_drop"
    DISCOUNT = "discount"
    WEATHER = "weather"
    TRANSPORT_DELAY = "transport_delay"
    SYSTEM = "system"
    REWARD = "reward"


class WalletTransactionType(StrEnum):
    TOP_UP = "top_up"
    PAYMENT = "payment"
    REFUND = "refund"
    REWARD = "reward"
    CASHBACK = "cashback"


class CouponType(StrEnum):
    PERCENT = "percent"
    FIXED = "fixed"


class ProviderType(StrEnum):
    HOTEL = "hotel"
    AIRLINE = "airline"
    RAIL = "rail"
    BUS = "bus"
    TOUR_OPERATOR = "tour_operator"
    RESTAURANT = "restaurant"
    GUIDE = "guide"


class AnalyticsEventName(StrEnum):
    APP_OPENED = "app_opened"
    SEARCH_STARTED = "search_started"
    DESTINATION_VIEWED = "destination_viewed"
    TRANSPORT_VIEWED = "transport_viewed"
    HOTEL_VIEWED = "hotel_viewed"
    HOTEL_FAVORITED = "hotel_favorited"
    BOOKING_STARTED = "booking_started"
    PAYMENT_STARTED = "payment_started"
    BOOKING_COMPLETED = "booking_completed"
    BOOKING_CANCELLED = "booking_cancelled"
    REVIEW_CREATED = "review_created"
    AI_PLAN_REQUESTED = "ai_plan_requested"
