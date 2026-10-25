from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/meta", tags=["Meta"])

AMENITIES = [
    "wifi", "parking", "pool", "breakfast", "spa", "gym", "restaurant",
    "air_conditioning", "pet_friendly", "accessible", "laundry", "airport_shuttle",
]

INTERESTS = [
    {"value": "history", "label": "تاریخ و فرهنگ"},
    {"value": "nature", "label": "طبیعت‌گردی"},
    {"value": "food", "label": "غذا و تجربه محلی"},
    {"value": "adventure", "label": "ماجراجویی"},
    {"value": "photography", "label": "عکاسی"},
    {"value": "shopping", "label": "خرید"},
    {"value": "religion", "label": "زیارت و مذهب"},
    {"value": "family", "label": "سفر خانوادگی"},
]


@router.get("/options", summary="گزینه‌های فرم‌ها و فیلترها")
async def options() -> dict:
    return {
        "transport_types": [
            {"value": "flight", "label": "هواپیما", "icon": "plane"},
            {"value": "train", "label": "قطار", "icon": "train"},
            {"value": "bus", "label": "اتوبوس", "icon": "bus"},
            {"value": "car", "label": "خودرو شخصی", "icon": "car"},
            {"value": "taxi", "label": "تاکسی", "icon": "taxi"},
        ],
        "accommodation_types": [
            {"value": "hotel", "label": "هتل"},
            {"value": "aparthotel", "label": "هتل‌آپارتمان"},
            {"value": "hostel", "label": "هاستل"},
            {"value": "villa", "label": "ویلا"},
            {"value": "eco_lodge", "label": "بوم‌گردی"},
            {"value": "apartment", "label": "آپارتمان"},
            {"value": "camp", "label": "کمپ"},
            {"value": "heritage", "label": "بنای تاریخی"},
        ],
        "attraction_categories": [
            {"value": "historical", "label": "تاریخی"},
            {"value": "natural", "label": "طبیعی"},
            {"value": "cultural", "label": "فرهنگی"},
            {"value": "entertainment", "label": "تفریحی"},
            {"value": "religious", "label": "مذهبی"},
            {"value": "shopping", "label": "خرید"},
            {"value": "museum", "label": "موزه"},
            {"value": "hidden_gem", "label": "کشف‌نشده"},
        ],
        "experience_categories": [
            {"value": "city_tour", "label": "تور شهری"},
            {"value": "food_tour", "label": "تور غذا"},
            {"value": "cooking", "label": "آشپزی محلی"},
            {"value": "handicraft", "label": "صنایع دستی"},
            {"value": "nature", "label": "طبیعت‌گردی"},
            {"value": "hiking", "label": "کوهنوردی"},
            {"value": "cycling", "label": "دوچرخه‌سواری"},
            {"value": "photography", "label": "تور عکاسی"},
            {"value": "adventure", "label": "ماجراجویی"},
            {"value": "local_life", "label": "زندگی محلی"},
        ],
        "amenities": AMENITIES,
        "interests": INTERESTS,
        "sort_options": {
            "transport": [
                {"value": "recommended", "label": "پیشنهادی"},
                {"value": "cheapest", "label": "ارزان‌ترین"},
                {"value": "fastest", "label": "سریع‌ترین"},
                {"value": "rating", "label": "بهترین امتیاز"},
            ],
            "accommodation": [
                {"value": "recommended", "label": "پیشنهادی"},
                {"value": "cheapest", "label": "ارزان‌ترین"},
                {"value": "rating", "label": "بالاترین امتیاز"},
                {"value": "distance", "label": "نزدیک‌ترین"},
            ],
        },
        "budget_levels": [
            {"value": "budget", "label": "اقتصادی"},
            {"value": "mid", "label": "متوسط"},
            {"value": "luxury", "label": "لوکس"},
        ],
        "levels": ["bronze", "silver", "gold", "platinum"],
    }
