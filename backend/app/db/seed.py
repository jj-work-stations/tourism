"""Idempotent demo seed data for the Seir travel platform.

Run inside the API container:
    python -m app.db.seed
    python -m app.db.seed --reset   # drops and recreates all tables
"""

from __future__ import annotations

import asyncio
import math
import random
import sys
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.base import Base
from app.db.models import (
    Accommodation,
    AccommodationType,
    Achievement,
    AnalyticsEvent,
    Attraction,
    AttractionCategory,
    Booking,
    BookingStatus,
    BookingType,
    Campaign,
    Challenge,
    Coupon,
    CouponType,
    Destination,
    EmergencyContact,
    Experience,
    ExperienceCategory,
    Favorite,
    FavoriteEntity,
    Notification,
    NotificationType,
    Passenger,
    PassportStamp,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Provider,
    ProviderType,
    Restaurant,
    Review,
    ReviewEntity,
    ReviewStatus,
    Role,
    Room,
    SupportTicket,
    TransportOffer,
    TransportType,
    Trip,
    TripActivity,
    TripActivityType,
    TripDay,
    TripStatus,
    User,
    UserAchievement,
    UserPreference,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
    WeatherSnapshot,
)
from app.db.session import SessionLocal, engine
from app.schemas.ai import PlanTripRequest
from app.services.planner import build_plan

TEHRAN = ZoneInfo("Asia/Tehran")
NOW = datetime.now(UTC)

SCENIC = [
    "photo-1519817650390-64a93db51149",
    "photo-1526772662000-3f88f10405ff",
    "photo-1500530855697-b586d89ba3ee",
    "photo-1476514525535-07fb3b4ae5f1",
    "photo-1500534623283-312aade485b7",
    "photo-1469474968028-56623f02e42e",
    "photo-1507525428034-b723cf961d3e",
    "photo-1469854523086-cc02fe5d8800",
]
HOTELS = [
    "photo-1566073771259-6a8506099945",
    "photo-1551882547-ff40c63fe5fa",
    "photo-1542314831-068cd1dbfeeb",
    "photo-1564501049412-61c2a3083791",
    "photo-1582719508461-905c673771fd",
]
ROOMS = [
    "photo-1611892440504-42a792e24d32",
    "photo-1590490360182-c33d57733427",
    "photo-1596394516093-501ba68a0ba6",
    "photo-1578683010236-d716f9a3f461",
]
FOOD = [
    "photo-1555396273-367ea4eb4db5",
    "photo-1414235077428-338989a2e8c0",
    "photo-1517248135467-4c7edcad34c4",
    "photo-1552566626-52f8b828add9",
]
EXPERIENCE_IMAGES = [
    "photo-1530789253388-582c481c54b0",
    "photo-1527631746610-bca00a040d60",
    "photo-1543872084-c7bd3822856f",
    "photo-1516483638261-f4dbaf036963",
]


def img(photo_id: str, width: int = 1600) -> str:
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w={width}&q=80"


def gallery(index: int, count: int = 4) -> list[str]:
    return [img(SCENIC[(index + offset) % len(SCENIC)]) for offset in range(count)]


DESTINATIONS = [
    {
        "slug": "tehran",
        "name": "Tehran",
        "name_local": "تهران",
        "region": "تهران",
        "lat": 35.6892,
        "lng": 51.3890,
        "popularity": 100,
        "featured": True,
        "tags": ["city", "history", "food", "shopping"],
        "best": "بهار و پاییز",
        "budget": 2_800_000,
        "short": "پایتخت پرجنب‌وجوی ایران؛ از کاخ‌های قاجاری تا کافه‌های مدرن و بازارهای تاریخی.",
        "description": "تهران شهری است که تاریخ و مدرنیته را در هم می‌آمیزد. موزه‌های جهانی، کاخ‌های باشکوه، بازار بزرگ و رستوران‌های متنوع، این شهر را به نقطه شروع بسیاری از سفرها تبدیل کرده است. متروی گسترده و تاکسی‌های اینترنتی جابه‌جایی را آسان می‌کند.",
        "attractions": [
            ("golestan-palace", "کاخ گلستان", "museum", 500_000, 4.8, 0.003, 0.004, 120),
            ("milad-tower", "برج میلاد", "entertainment", 800_000, 4.5, -0.045, -0.012, 90),
            ("tehran-grand-bazaar", "بازار بزرگ تهران", "shopping", 0, 4.4, 0.004, -0.002, 120),
            ("national-museum-iran", "موزه ملی ایران", "museum", 350_000, 4.6, 0.006, -0.001, 100),
            ("tabiat-bridge", "پل طبیعت", "entertainment", 0, 4.7, -0.020, 0.006, 60),
        ],
        "hotels": [
            ("espinas-palace", "هتل اسپیناس پالاس", "hotel", 9_500_000, 4.8, 5, "هتل پنج‌ستاره لوکس در قلب تهران با رستوران‌های بین‌المللی و استخر سرپوشیده."),
            ("parsian-esteghlal", "هتل پارسیان استقلال", "hotel", 5_200_000, 4.4, 4, "هتلی کلاسیک با موقعیت عالی در شمال تهران و چشم‌انداز کوه‌های البرز."),
            ("tehran-hostel", "هاستل جوانان تهران", "hostel", 1_100_000, 4.3, 2, "اقامتگاه اقتصادی و دوستانه برای مسافران مستقل در مرکز شهر."),
        ],
        "restaurants": [
            ("nayeb", "رستوران نایب", "ایرانی", 3, 900_000, 4.6, ["چلوکباب سلطانی", "جوجه کباب زعفرانی"]),
            ("golestan-cafe", "کافه رستوران گلستان", "بین‌المللی", 2, 650_000, 4.4, ["برگر دست‌ساز", "سالاد سزار"]),
        ],
        "experiences": [
            ("bazaar-walk", "تور پیاده‌روی بازار تهران", "city_tour", 850_000, 180, 4.7, "گشت سه‌ساعته در بازار بزرگ با راهنمای محلی و چشیدن چای سنتی."),
            ("persian-cooking", "کارگاه آشپزی غذای ایرانی", "cooking", 1_600_000, 240, 4.9, "آموزش پخت سه غذای اصیل ایرانی همراه با بازار خرید مواد اولیه."),
        ],
    },
    {
        "slug": "shiraz",
        "name": "Shiraz",
        "name_local": "شیراز",
        "region": "فارس",
        "lat": 29.5918,
        "lng": 52.5837,
        "popularity": 98,
        "featured": True,
        "tags": ["history", "food", "nature", "poetry"],
        "best": "فروردین تا اردیبهشت",
        "budget": 2_500_000,
        "short": "شهر شعر و شراب نارنج؛ حافظیه، تخت جمشید و باغ‌های ایرانی در انتظار شماست.",
        "description": "شیراز پایتخت فرهنگی ایران است. آرامگاه حافظ و سعدی، باغ‌های دل‌انگیز، بازار وکیل و فاصله کوتاه تا تخت جمشید، سفری چندلایه را ممکن می‌کند. غروب‌های شیراز و غذاهای محلی مثل کلم‌پلو و فالوده را از دست ندهید.",
        "attractions": [
            ("hafez-tomb", "آرامگاه حافظ", "historical", 350_000, 4.9, 0.020, 0.006, 90),
            ("persepolis", "تخت جمشید", "historical", 1_200_000, 4.9, 0.560, 0.020, 180),
            ("eram-garden", "باغ ارم", "natural", 500_000, 4.7, 0.015, 0.045, 90),
            ("vakil-bazaar", "بازار وکیل", "shopping", 0, 4.5, 0.002, 0.003, 120),
            ("nasir-al-molk", "مسجد نصیرالملک", "religious", 500_000, 4.8, 0.005, -0.006, 60),
        ],
        "hotels": [
            ("zandieh", "هتل زندیه", "hotel", 7_800_000, 4.7, 5, "هتل پنج‌ستاره در نزدیکی حافظیه با معماری ایرانی و امکانات کامل."),
            ("parsian-shiraz", "هتل پارسیان شیراز", "hotel", 4_800_000, 4.4, 4, "اقامتگاهی راحت و اقتصادی در مرکز شیراز با صبحانه کامل."),
            ("shiraz-eco-lodge", "اقامتگاه بوم‌گردی نارنجستان", "eco_lodge", 2_300_000, 4.6, 3, "خانه‌ای تاریخی با حیاط مرکزی، صبحانه محلی و میزبانی گرم."),
        ],
        "restaurants": [
            ("haft-khan", "رستوران هفت‌خان", "ایرانی", 3, 1_100_000, 4.7, ["کلم‌پلو", "قورمه‌سبزی", "باقالی‌پلو"]),
            ("faloodeh-shirazi", "کافه فالوده شیرازی", "دسر", 1, 250_000, 4.8, ["فالوده", "بستنی سنتی"]),
        ],
        "experiences": [
            ("shiraz-food-tour", "تور غذای شیراز", "food_tour", 1_500_000, 180, 4.8, "چشیدن ۶ غذای محلی شیراز در بازار و رستوران‌های قدیمی."),
            ("hafez-night", "شب شعر حافظ", "local_life", 700_000, 120, 4.9, "شب‌نشینی با شعر و موسیقی سنتی در محوطه حافظیه."),
        ],
    },
    {
        "slug": "isfahan",
        "name": "Isfahan",
        "name_local": "اصفهان",
        "region": "اصفهان",
        "lat": 32.6546,
        "lng": 51.6680,
        "popularity": 96,
        "featured": True,
        "tags": ["history", "culture", "food", "architecture"],
        "best": "اسفند تا اردیبهشت",
        "budget": 2_600_000,
        "short": "نصف جهان؛ میدان نقش جهان، پل‌های تاریخی و هنر قلم‌زنی.",
        "description": "اصفهان با معماری صفوی و محور زاینده‌رود، یکی از زیباترین شهرهای جهان است. میدان نقش جهان، مسجد شیخ لطف‌الله، چهلستون و بازار صنایع دستی، روزها را پر می‌کنند. کافه‌های کنار پل سی‌وسه‌پل برای شب‌گردی ایده‌آل‌اند.",
        "attractions": [
            ("naqsh-e-jahan", "میدان نقش جهان", "historical", 0, 4.9, 0.0, 0.0, 150),
            ("jameh-mosque", "مسجد جامع اصفهان", "religious", 400_000, 4.8, 0.010, -0.007, 100),
            ("si-o-se-pol", "سی‌وسه‌پل", "historical", 0, 4.8, -0.013, 0.008, 60),
            ("chehel-sotoun", "باغ چهلستون", "historical", 500_000, 4.6, 0.009, 0.001, 80),
            ("isfahan-music-museum", "موزه موسیقی اصفهان", "museum", 300_000, 4.5, -0.006, 0.004, 70),
        ],
        "hotels": [
            ("abbasi", "هتل عباسی", "heritage", 8_500_000, 4.9, 5, "کاروانسرای صفوی با حیاط فیروزه‌ای؛ تجربه اقامت در دل تاریخ."),
            ("avin", "هتل آوین", "hotel", 4_200_000, 4.5, 4, "هتل مدرن و آرام با دسترسی آسان به میدان نقش جهان."),
        ],
        "restaurants": [
            ("sheyda", "رستوران شیدا", "ایرانی", 3, 950_000, 4.6, ["بریانی اصفهانی", "کباب بختیاری"]),
            ("chehelsotoun-cafe", "کافه چهلستون", "کافه", 2, 520_000, 4.4, ["قهوه اسپرسو", "کیک زعفرانی"]),
        ],
        "experiences": [
            ("isfahan-bike-tour", "تور دوچرخه‌سواری اصفهان", "cycling", 900_000, 150, 4.7, "دوچرخه‌سواری در حاشیه زاینده‌رود و پل‌های تاریخی."),
            ("ghalamzani-workshop", "کارگاه قلم‌زنی", "handicraft", 1_200_000, 120, 4.8, "ساخت یک اثر قلم‌زنی کوچک با راهنمایی استاد اصفهانی."),
        ],
    },
    {
        "slug": "tabriz",
        "name": "Tabriz",
        "name_local": "تبریز",
        "region": "آذربایجان شرقی",
        "lat": 38.0800,
        "lng": 46.2919,
        "popularity": 82,
        "featured": False,
        "tags": ["history", "food", "shopping", "nature"],
        "best": "تابستان",
        "budget": 2_200_000,
        "short": "شهر بازار تاریخی و کوه‌های سرسبز؛ دروازه آذربایجان و طبیعت شمال‌غرب.",
        "description": "تبریز با بازار سرپوشیده ثبت‌شده در یونسکو، غذاهای آذربایجانی و نزدیکی به روستاهای تاریخی، مقصدی متفاوت است. ائل‌گلی، مسجد کبود و موزه آذربایجان از دیدنی‌های اصلی‌اند.",
        "attractions": [
            ("tabriz-bazaar", "بازار تاریخی تبریز", "historical", 0, 4.7, 0.0, 0.0, 120),
            ("blue-mosque", "مسجد کبود", "religious", 250_000, 4.6, 0.003, 0.005, 60),
            ("el-goli", "ائل‌گلی", "natural", 100_000, 4.5, 0.035, 0.015, 90),
            ("azerbaijan-museum", "موزه آذربایجان", "museum", 250_000, 4.5, 0.002, -0.001, 80),
        ],
        "hotels": [
            ("pars-elgoli", "هتل پارس ائل‌گلی", "hotel", 6_900_000, 4.7, 5, "هتل مدرن مشرف به دریاچه ائل‌گلی با اسپا و رستوران."),
            ("shahriar", "هتل شهریار", "hotel", 3_600_000, 4.3, 4, "هتل اقتصادی در مرکز تبریز با دسترسی خوب به بازار."),
        ],
        "restaurants": [
            ("elgoli-restaurant", "رستوران ائل‌گلی", "آذربایجانی", 2, 750_000, 4.6, ["چلوکباب", "آش دوغ"]),
            ("azarbaijan-kabab", "کباب آذربایجان", "کباب", 2, 680_000, 4.7, ["کباب بناب", "جوجه کباب"]),
        ],
        "experiences": [
            ("tabriz-carpet-tour", "تور فرش و بازار تبریز", "city_tour", 800_000, 150, 4.6, "آشنایی با تاریخ فرش تبریز و خرید از بازار سرپوشیده."),
            ("azari-cooking", "کارگاه آشپزی آذربایجانی", "cooking", 1_300_000, 180, 4.8, "پخت دلمه و آش آذربایجانی با بانوی خانه."),
        ],
    },
    {
        "slug": "mashhad",
        "name": "Mashhad",
        "name_local": "مشهد",
        "region": "خراسان رضوی",
        "lat": 36.2605,
        "lng": 59.6168,
        "popularity": 94,
        "featured": True,
        "tags": ["religion", "history", "food", "family"],
        "best": "بهار و پاییز",
        "budget": 2_400_000,
        "short": "پایتخت معنوی ایران؛ حرم رضوی، بازارهای سنتی و نزدیکی به توس.",
        "description": "مشهد سالانه میزبان میلیون‌ها زائر است. حرم امام رضا (ع)، مسجد گوهرشاد، آرامگاه فردوسی در توس و بازارهای زعفران، ترکیبی از معنویت و فرهنگ خراسان را ارائه می‌دهند.",
        "attractions": [
            ("imam-reza-shrine", "حرم امام رضا", "religious", 0, 4.9, 0.0, 0.0, 180),
            ("kuhsangi-park", "پارک کوهسنگی", "natural", 0, 4.4, -0.020, 0.015, 90),
            ("ferdowsi-tomb", "آرامگاه فردوسی", "historical", 400_000, 4.7, 0.550, 0.045, 100),
            ("reza-bazaar", "بازار رضا", "shopping", 0, 4.4, 0.002, -0.001, 90),
        ],
        "hotels": [
            ("ghasr-talaei", "هتل قصر طلایی", "hotel", 7_200_000, 4.7, 5, "هتل نزدیک حرم با سرویس تشرف و امکانات کامل خانوادگی."),
            ("pardisan", "هتل پردیسان", "hotel", 3_900_000, 4.4, 4, "هتل آرام با دسترسی به مرکز شهر و پارکینگ."),
        ],
        "restaurants": [
            ("karimi", "رستوران پسران کریمی", "ایرانی", 3, 1_000_000, 4.6, ["شیشلیک", "چلوکباب"]),
            ("rezaei-shole", "شله‌مشهدی رضایی", "سنتی", 1, 180_000, 4.7, ["شله", "حلیم"]),
        ],
        "experiences": [
            ("mashhad-ziyarat", "تور زیارتی مشهد", "city_tour", 600_000, 180, 4.8, "همراهی راهنمای مذهبی برای زیارت حرم و اماکن متبرکه."),
            ("saffron-workshop", "کارگاه زعفران", "handicraft", 700_000, 90, 4.5, "آشنایی با زعفران خراسان و بسته‌بندی آن."),
        ],
    },
    {
        "slug": "yazd",
        "name": "Yazd",
        "name_local": "یزد",
        "region": "یزد",
        "lat": 31.8974,
        "lng": 54.3569,
        "popularity": 78,
        "featured": True,
        "tags": ["history", "nature", "culture", "desert"],
        "best": "پاییز و زمستان",
        "budget": 1_900_000,
        "short": "شهر بادگیرها و کویر؛ معماری خاکی و آسمان پرستاره.",
        "description": "یزد شهری آرام با بافت تاریخی زنده و بادگیرهای شگفت‌انگیز است. از باغ دولت‌آباد تا کویر و برج خاموشان، یزد تجربه‌ای متفاوت از ایران ارائه می‌دهد.",
        "attractions": [
            ("dolatabad-garden", "باغ دولت‌آباد", "historical", 350_000, 4.7, 0.005, 0.006, 80),
            ("jameh-mosque-yazd", "مسجد جامع یزد", "religious", 250_000, 4.8, 0.001, 0.0, 70),
            ("towers-of-silence", "برج خاموشان", "historical", 400_000, 4.5, -0.018, 0.012, 90),
            ("yazd-old-town", "بافت تاریخی یزد", "cultural", 0, 4.8, -0.002, 0.002, 120),
        ],
        "hotels": [
            ("dad", "هتل داد", "heritage", 4_600_000, 4.8, 4, "خانه‌ای قاجاری با اتاق‌های سنتی و حیاط دل‌انگیز."),
            ("safaeiyeh", "هتل صفائیه", "hotel", 3_200_000, 4.4, 4, "هتل مدرن با دسترسی مناسب به بافت تاریخی."),
        ],
        "restaurants": [
            ("yazd-house", "رستوران خانه یزد", "سنتی", 3, 900_000, 4.7, ["اشکنه", "کباب یزدی"]),
            ("boom-cafe", "کافه بوم‌گردی", "کافه", 2, 500_000, 4.5, ["چای یزدی", "کیک خانگی"]),
        ],
        "experiences": [
            ("yazd-desert", "تور کویر یزد", "nature", 1_400_000, 360, 4.9, "شب‌مانی در کویر با شام سنتی و رصد ستارگان."),
            ("yazd-sweets", "کارگاه شیرینی یزدی", "cooking", 800_000, 120, 4.6, "پخت قطاب و باقلوا با خانواده‌ای یزدی."),
        ],
    },
    {
        "slug": "kerman",
        "name": "Kerman",
        "name_local": "کرمان",
        "region": "کرمان",
        "lat": 30.2839,
        "lng": 57.0834,
        "popularity": 72,
        "featured": False,
        "tags": ["nature", "history", "desert", "adventure"],
        "best": "پاییز",
        "budget": 1_800_000,
        "short": "دروازه کویر لوت؛ باغ شاهزاده، گنجعلی‌خان و آسمان بی‌پایان.",
        "description": "کرمان نقطه شروع سفر به کویر لوت و کلوت‌های شهداد است. بازار گنجعلی‌خان، باغ شاهزاده ماهان و خانه‌های تاریخی، تجربه‌ای اصیل از جنوب‌شرق ایران می‌سازند.",
        "attractions": [
            ("shahzadeh-garden", "باغ شاهزاده ماهان", "natural", 350_000, 4.8, 0.300, 0.100, 100),
            ("ganjali-khan", "مجموعه گنجعلی‌خان", "historical", 0, 4.7, 0.002, 0.001, 90),
            ("kerman-bazaar", "بازار کرمان", "shopping", 0, 4.5, 0.001, 0.003, 80),
            ("shahdad-kaluts", "کلوت‌های شهداد", "natural", 800_000, 4.9, 1.500, 1.200, 240),
        ],
        "hotels": [
            ("pars-kerman", "هتل پارس کرمان", "hotel", 5_800_000, 4.6, 5, "هتل پنج‌ستاره با امکانات کامل در مرکز کرمان."),
            ("aram", "هتل ارم", "hotel", 3_400_000, 4.3, 4, "هتل اقتصادی و تمیز با صبحانه محلی."),
        ],
        "restaurants": [
            ("ganjali-restaurant", "رستوران گنجعلی‌خان", "سنتی", 2, 600_000, 4.5, ["کباب کرمانی", "آش شله"]),
            ("mahan-cafe", "کافه ماهان", "کافه", 1, 350_000, 4.4, ["قهوه", "شیرینی"]),
        ],
        "experiences": [
            ("lut-desert", "تور کویر لوت", "adventure", 2_000_000, 480, 4.9, "سافاری در کلوت‌ها، غروب و شام در کویر."),
            ("mahan-photography", "تور عکاسی ماهان", "photography", 900_000, 180, 4.7, "عکاسی از باغ شاهزاده و بافت تاریخی با راهنمای حرفه‌ای."),
        ],
    },
    {
        "slug": "kish",
        "name": "Kish",
        "name_local": "کیش",
        "region": "هرمزگان",
        "lat": 26.5578,
        "lng": 53.9805,
        "popularity": 88,
        "featured": True,
        "tags": ["nature", "shopping", "family", "beach"],
        "best": "آبان تا فروردین",
        "budget": 4_200_000,
        "short": "جزیره مرجانی با سواحل فیروزه‌ای، خرید و تفریحات آبی.",
        "description": "کیش مقصدی برای تفریح، خرید و ساحل است. آب‌های زلال، ورزش‌های آبی، بازارهای معاف از مالیات و هتل‌های لوکس، آن را به گزینه‌ای محبوب برای تعطیلات کوتاه تبدیل کرده است.",
        "attractions": [
            ("marjan-beach", "ساحل مرجان", "natural", 0, 4.6, 0.010, 0.005, 120),
            ("kariz-underground", "شهر زیرزمینی کاریز", "historical", 450_000, 4.4, 0.002, -0.002, 60),
            ("hengam-island", "جزیره هنگام", "natural", 900_000, 4.8, -0.220, 0.150, 240),
            ("kish-bazaar", "بازار مرجان", "shopping", 0, 4.2, 0.001, 0.001, 90),
        ],
        "hotels": [
            ("darius", "هتل داریوش", "hotel", 8_900_000, 4.8, 5, "هتل ساحلی پنج‌ستاره با استخر، اسپا و دسترسی اختصاصی به ساحل."),
            ("shayan", "هتل شایان", "hotel", 4_900_000, 4.5, 4, "هتل خانوادگی نزدیک بازار و ساحل با صبحانه بوفه."),
        ],
        "restaurants": [
            ("sahel", "رستوران ساحل", "دریایی", 3, 1_200_000, 4.7, ["ماهی قزل‌آلا", "میگو گریل"]),
            ("mira-cafe", "کافه میرا", "بین‌المللی", 2, 750_000, 4.5, ["پاستا", "برگر"]),
        ],
        "experiences": [
            ("kish-boat", "تور قایق‌سواری", "adventure", 1_500_000, 120, 4.8, "گشت با قایق در آب‌های فیروزه‌ای و دیدن دلفین‌ها."),
            ("kish-diving", "غواصی در کیش", "adventure", 2_400_000, 150, 4.9, "غواصی با مربی حرفه‌ای و تجهیزات کامل."),
        ],
    },
]

ROUTES = [
    ("tehran", "shiraz", 3_600_000, 1_700_000, 900_000),
    ("shiraz", "tehran", 3_600_000, 1_700_000, 900_000),
    ("tehran", "isfahan", 3_100_000, 1_300_000, 750_000),
    ("isfahan", "tehran", 3_100_000, 1_300_000, 750_000),
    ("tehran", "mashhad", 4_200_000, 2_000_000, 1_100_000),
    ("mashhad", "tehran", 4_200_000, 2_000_000, 1_100_000),
    ("tehran", "tabriz", 3_300_000, 1_500_000, 850_000),
    ("tabriz", "tehran", 3_300_000, 1_500_000, 850_000),
    ("tehran", "yazd", 2_900_000, 1_200_000, 700_000),
    ("yazd", "tehran", 2_900_000, 1_200_000, 700_000),
    ("shiraz", "isfahan", 2_700_000, 1_100_000, 650_000),
    ("isfahan", "shiraz", 2_700_000, 1_100_000, 650_000),
    ("mashhad", "kerman", 4_000_000, 1_800_000, 1_000_000),
    ("kerman", "mashhad", 4_000_000, 1_800_000, 1_000_000),
    ("tehran", "kish", 5_200_000, None, None),
    ("kish", "tehran", 5_200_000, None, None),
]

AMENITIES = [
    "wifi", "parking", "pool", "breakfast", "spa", "gym",
    "restaurant", "air_conditioning", "laundry", "airport_shuttle",
]


async def seed_reference(db: AsyncSession) -> None:
    achievements = [
        ("first_destination", "اولین مهر سفر", "اولین مقصد را در پاسپورت خود ثبت کنید.", "🛂", "passport", 50, {"stamps": 1}),
        ("five_cities", "کاوشگر شهرها", "به ۵ مقصد مختلف سفر کنید.", "🧭", "passport", 150, {"stamps": 5}),
        ("ten_cities", "جهان‌گرد", "به ۱۰ مقصد مختلف سفر کنید.", "🌍", "passport", 400, {"stamps": 10}),
        ("first_trip", "اولین سفر", "اولین رزرو خود را تکمیل کنید.", "✈️", "booking", 60, {"bookings": 1}),
        ("food_explorer", "کاشف طعم‌ها", "یک تجربه غذایی رزرو کنید.", "🍲", "interest", 80, {"category": "food"}),
        ("nature_explorer", "دوست طبیعت", "یک تجربه طبیعت‌گردی رزرو کنید.", "🌿", "interest", 80, {"category": "nature"}),
        ("history_explorer", "تاریخ‌گرد", "از سه جاذبه تاریخی دیدن کنید.", "🏛️", "interest", 100, {"category": "history", "count": 3}),
        ("reviewer", "صدای مسافران", "اولین نظر خود را ثبت کنید.", "✍️", "community", 40, {"reviews": 1}),
        ("ai_planner", "برنامه‌ریز هوشمند", "از دستیار هوشمند سیر برنامه بگیرید.", "🤖", "ai", 30, {"ai_plans": 1}),
    ]
    for code, title, description, icon, category, xp, criteria in achievements:
        exists = (await db.execute(select(Achievement).where(Achievement.code == code))).scalar_one_or_none()
        if exists is None:
            db.add(Achievement(code=code, title=title, description=description, icon=icon, category=category, xp_reward=xp, criteria=criteria))
    challenges = [
        ("book_two", "دو رزرو در ماه", "در ماه جاری دو رزرو کامل کنید.", "🎟️", 100, 2, "bookings"),
        ("review_one", "تجربه‌ات را بگو", "یک نظر برای اقامتگاه یا جاذبه ثبت کنید.", "⭐", 40, 1, "reviews"),
        ("visit_three", "سه مقصد تازه", "سه مقصد جدید را در پاسپورت ثبت کنید.", "📍", 120, 3, "visits"),
    ]
    for code, title, description, icon, xp, target, metric in challenges:
        exists = (await db.execute(select(Challenge).where(Challenge.code == code))).scalar_one_or_none()
        if exists is None:
            db.add(Challenge(code=code, title=title, description=description, icon=icon, xp_reward=xp, target=target, metric=metric, is_active=True))
    coupons = [
        ("WELCOME20", "۲۰٪ تخفیف اولین سفر", "برای رزروهای بالای ۲ میلیون تومان", CouponType.PERCENT, 20, 2_000_000, 1_500_000),
        ("STAYMORE", "۵۰۰ هزار تومان تخفیف اقامت", "برای اقامت‌های بالای ۳ میلیون تومان", CouponType.FIXED, 500_000, 3_000_000, None),
        ("NOWRUZ15", "جشنواره نوروزی", "۱۵٪ تخفیف تا سقف ۱ میلیون تومان", CouponType.PERCENT, 15, 1_000_000, 1_000_000),
    ]
    for code, title, description, ctype, value, minimum, maximum in coupons:
        exists = (await db.execute(select(Coupon).where(Coupon.code == code))).scalar_one_or_none()
        if exists is None:
            db.add(Coupon(code=code, title=title, description=description, coupon_type=ctype, value=value, min_amount=minimum, max_discount=maximum, usage_limit=10000, per_user_limit=1, valid_from=datetime(2025, 1, 1, tzinfo=UTC), valid_to=datetime(2030, 1, 1, tzinfo=UTC), is_active=True))


async def seed_catalog(db: AsyncSession) -> None:
    providers = {
        "mahan-air": ("ماهان ایر", ProviderType.AIRLINE, "airline", 4.6),
        "raja-rail": ("راه‌آهن رجا", ProviderType.RAIL, "rail", 4.3),
        "pars-bus": ("سیر و سفر پارس", ProviderType.BUS, "bus", 4.1),
        "parsian-hotels": ("گروه هتل‌های پارسیان", ProviderType.HOTEL, "hotel", 4.7),
        "seir-experiences": ("تجربه‌های سیر", ProviderType.TOUR_OPERATOR, "tour_operator", 4.8),
    }
    provider_objs: dict[str, Provider] = {}
    for slug, (name, ptype, _, rating) in providers.items():
        provider = Provider(slug=slug, name=name, provider_type=ptype.value, rating=rating, is_verified=True, is_active=True, commission_rate=12)
        db.add(provider)
        provider_objs[slug] = provider
    await db.flush()

    dest_objs: dict[str, Destination] = {}
    for index, data in enumerate(DESTINATIONS):
        dest = Destination(
            slug=data["slug"],
            name=data["name"],
            name_local=data["name_local"],
            country="Iran",
            country_code="IR",
            region=data["region"],
            description=data["description"],
            short_description=data["short"],
            image_url=img(SCENIC[index % len(SCENIC)]),
            gallery=gallery(index, 4),
            latitude=data["lat"],
            longitude=data["lng"],
            is_featured=data["featured"],
            popularity=data["popularity"],
            tags=data["tags"],
            best_season=data["best"],
            avg_daily_budget=data["budget"],
        )
        db.add(dest)
        dest_objs[data["slug"]] = dest
    await db.flush()

    for index, data in enumerate(DESTINATIONS):
        dest = dest_objs[data["slug"]]
        for a_index, (slug, name, category, price, rating, lat_off, lng_off, minutes) in enumerate(data["attractions"]):
            db.add(
                Attraction(
                    slug=slug,
                    name=name,
                    destination_id=dest.id,
                    category=AttractionCategory(category),
                    description=f"{name} یکی از دیدنی‌های {data['name_local']} است. بازدید از این جاذبه با راهنمای محلی تجربه‌ای کامل‌تر می‌سازد.",
                    image_url=img(SCENIC[(index + a_index) % len(SCENIC)], 1200),
                    gallery=gallery(index + a_index, 3),
                    latitude=data["lat"] + lat_off,
                    longitude=data["lng"] + lng_off,
                    address=f"{data['name_local']}، {name}",
                    opening_hours={"weekdays": "09:00-18:00", "weekends": "09:00-20:00"},
                    ticket_price=price,
                    rating=rating,
                    review_count=random.randint(80, 1200),
                    suggested_visit_minutes=minutes,
                    is_featured=a_index == 0,
                )
            )
        for h_index, (slug, name, htype, price, rating, stars, description) in enumerate(data["hotels"]):
            hotel = Accommodation(
                slug=slug,
                name=name,
                destination_id=dest.id,
                provider_id=provider_objs["parsian-hotels"].id,
                type=AccommodationType(htype),
                description=description + " این اقامتگاه با تیم سیر همکاری می‌کند و رزرو آن شامل پشتیبانی ۲۴ ساعته است.",
                short_description=description,
                address=f"{data['name_local']}، خیابان اصلی",
                latitude=data["lat"] + h_index * 0.006 - 0.003,
                longitude=data["lng"] + h_index * 0.005 - 0.002,
                star_rating=stars,
                guest_rating=rating,
                review_count=random.randint(120, 2000),
                images=[img(HOTELS[(index + h_index) % len(HOTELS)]) for _ in range(3)],
                amenities=AMENITIES[: 6 + h_index % 4],
                rules=["ورود با مدارک شناسایی", "ممنوعیت استعمال دخانیات در اتاق‌ها", "ساعت خروج ۱۲:۰۰"],
                policies={"check_in": "14:00", "check_out": "12:00", "children": "کودکان زیر ۶ سال رایگان"},
                cancellation_policy="لغو رایگان تا ۴۸ ساعت قبل از ورود" if h_index != 2 else "لغو تا ۷ روز قبل با کسر ۲۰٪",
                breakfast_included=True,
                free_cancellation=h_index != 2,
                base_price=price,
                distance_to_center_km=round(0.8 + h_index * 1.7, 1),
                is_featured=h_index == 0,
            )
            db.add(hotel)
            await db.flush()
            room_types = [
                ("اتاق دو تخته دلوکس", "double", 2, 1.0),
                ("اتاق سه تخته", "triple", 3, 1.25),
                ("سوئیت خانوادگی", "suite", 4, 1.65),
            ]
            for r_index, (r_name, r_type, capacity, multiplier) in enumerate(room_types):
                db.add(
                    Room(
                        accommodation_id=hotel.id,
                        name=r_name,
                        room_type=r_type,
                        description="اتاق با طراحی مدرن، سرویس بهداشتی اختصاصی و منظره شهر.",
                        capacity=capacity,
                        beds=f"{capacity - 1} تخت" if capacity > 2 else "۱ تخت دو نفره",
                        size_sqm=22 + r_index * 8,
                        price_per_night=int(price * multiplier),
                        total_rooms=6 + r_index * 2,
                        amenities=["wifi", "air_conditioning", "tv", "minibar"],
                        images=[img(ROOMS[(index + r_index) % len(ROOMS)], 1000)],
                        breakfast_included=True,
                        refundable=True,
                    )
                )
        for r_index, (slug, name, cuisine, price_range, avg, rating, dishes) in enumerate(data["restaurants"]):
            menu = [{"name": dish, "price": int(avg * 0.8), "description": "غذای محلی"} for dish in dishes]
            db.add(
                Restaurant(
                    slug=slug,
                    name=name,
                    destination_id=dest.id,
                    description=f"{name} با فضایی گرم و منوی {cuisine}، یکی از انتخاب‌های محبوب مسافران {data['name_local']} است.",
                    image_url=img(FOOD[(index + r_index) % len(FOOD)], 1200),
                    gallery=[img(FOOD[(index + r_index + k) % len(FOOD)], 1000) for k in range(3)],
                    cuisine=cuisine,
                    price_range=price_range,
                    average_price=avg,
                    rating=rating,
                    review_count=random.randint(50, 900),
                    address=f"{data['name_local']}، مرکز شهر",
                    latitude=data["lat"] + 0.004 * (r_index + 1),
                    longitude=data["lng"] - 0.003 * (r_index + 1),
                    opening_hours={"daily": "12:00-23:00"},
                    menu=menu,
                    signature_dishes=dishes,
                    reservation_enabled=True,
                    is_featured=r_index == 0,
                )
            )
        for e_index, (slug, name, category, price, duration, rating, description) in enumerate(data["experiences"]):
            db.add(
                Experience(
                    slug=slug,
                    name=name,
                    destination_id=dest.id,
                    provider_id=provider_objs["seir-experiences"].id,
                    category=ExperienceCategory(category),
                    description=description,
                    image_url=img(EXPERIENCE_IMAGES[(index + e_index) % len(EXPERIENCE_IMAGES)], 1200),
                    gallery=[img(EXPERIENCE_IMAGES[(index + e_index + k) % len(EXPERIENCE_IMAGES)], 1000) for k in range(2)],
                    duration_minutes=duration,
                    price=price,
                    rating=rating,
                    review_count=random.randint(20, 500),
                    max_participants=12,
                    meeting_point=f"{data['name_local']}، مرکز اطلاع‌رسانی سیر",
                    latitude=data["lat"] + 0.003,
                    longitude=data["lng"] + 0.002,
                    includes=["راهنمای محلی", "بیمه", "پذیرایی"],
                    languages=["فارسی", "انگلیسی"],
                    guide_name="راهنمای مجاز سیر",
                    is_featured=e_index == 0,
                )
            )
        db.add(
            WeatherSnapshot(
                destination_id=dest.id,
                observed_at=NOW,
                temperature_c=18 + (index % 8),
                feels_like_c=17 + (index % 8),
                condition=["آفتابی", "نیمه‌ابری", "بارانی", "آفتابی"][index % 4],
                humidity=25 + index * 3,
                wind_kph=6 + index,
                forecast=[
                    {
                        "date": (date.today() + timedelta(days=d)).isoformat(),
                        "temp_min": 11 + (index % 7),
                        "temp_max": 22 + (index % 8),
                        "condition": ["آفتابی", "نیمه‌ابری", "بارانی"][(index + d) % 3],
                    }
                    for d in range(5)
                ],
            )
        )
        for e_index, (name, category, phone) in enumerate([
            ("اورژانس", "hospital", "115"),
            ("پلیس", "police", "110"),
            ("آتش‌نشانی", "fire", "125"),
            ("مرکز اطلاعات گردشگری", "tourist_info", "021-12345678"),
        ]):
            db.add(
                EmergencyContact(
                    destination_id=dest.id,
                    name=f"{name} {data['name_local']}",
                    category=category,
                    phone=phone,
                    address=f"{data['name_local']}، مرکز شهر",
                    latitude=data["lat"] + 0.01 * (e_index + 1),
                    longitude=data["lng"] - 0.01 * (e_index + 1),
                )
            )
    await db.flush()

    # Transportation inventory for the next 30 days
    soon = date.today() + timedelta(days=1)
    for origin_slug, dest_slug, flight_price, train_price, bus_price in ROUTES:
        origin = dest_objs[origin_slug]
        dest = dest_objs[dest_slug]
        distance_factor = 1 + (math.dist([origin.latitude, origin.longitude], [dest.latitude, dest.longitude]) / 10)
        for day_offset in range(30):
            travel_date = soon + timedelta(days=day_offset)
            for hour, minute in ((8, 30), (16, 45)):
                departure = datetime.combine(travel_date, time(hour, minute), tzinfo=TEHRAN).astimezone(UTC)
                db.add(
                    TransportOffer(
                        provider_id=provider_objs["mahan-air"].id,
                        type=TransportType.FLIGHT,
                        code=f"MA-{origin_slug[:2].upper()}{dest_slug[:2].upper()}{day_offset}{hour}",
                        origin_id=origin.id,
                        destination_id=dest.id,
                        departure_at=departure,
                        arrival_at=departure + timedelta(minutes=int(80 + distance_factor * 12)),
                        duration_minutes=int(80 + distance_factor * 12),
                        price=int(flight_price * (1.0 if hour == 8 else 1.08)),
                        stops=0,
                        capacity=120,
                        seats_available=120,
                        rating=4.6,
                        comfort_score=5,
                        baggage_allowance="۲۰ کیلوگرم + ۷ کیلوگرم دستی",
                        amenities=["wifi", "meal", "entertainment"],
                        cancellation_policy="لغو تا ۲۴ ساعت قبل با کسر ۲۰٪",
                    )
                )
            if train_price:
                departure = datetime.combine(travel_date, time(21, 0), tzinfo=TEHRAN).astimezone(UTC)
                duration = int(600 + distance_factor * 70)
                db.add(
                    TransportOffer(
                        provider_id=provider_objs["raja-rail"].id,
                        type=TransportType.TRAIN,
                        code=f"RJ-{origin_slug[:2].upper()}{dest_slug[:2].upper()}{day_offset}",
                        origin_id=origin.id,
                        destination_id=dest.id,
                        departure_at=departure,
                        arrival_at=departure + timedelta(minutes=duration),
                        duration_minutes=duration,
                        price=train_price,
                        stops=1,
                        capacity=200,
                        seats_available=200,
                        rating=4.3,
                        comfort_score=4,
                        baggage_allowance="۳۰ کیلوگرم",
                        amenities=["wifi", "restaurant", "power"],
                        cancellation_policy="لغو تا ۴۸ ساعت قبل با کسر ۱۰٪",
                    )
                )
            if bus_price:
                departure = datetime.combine(travel_date, time(20, 30), tzinfo=TEHRAN).astimezone(UTC)
                duration = int(720 + distance_factor * 80)
                db.add(
                    TransportOffer(
                        provider_id=provider_objs["pars-bus"].id,
                        type=TransportType.BUS,
                        code=f"PB-{origin_slug[:2].upper()}{dest_slug[:2].upper()}{day_offset}",
                        origin_id=origin.id,
                        destination_id=dest.id,
                        departure_at=departure,
                        arrival_at=departure + timedelta(minutes=duration),
                        duration_minutes=duration,
                        price=bus_price,
                        stops=2,
                        capacity=40,
                        seats_available=40,
                        rating=4.1,
                        comfort_score=3,
                        baggage_allowance="۲۵ کیلوگرم",
                        amenities=["wifi", "ac", "snack"],
                        cancellation_policy="لغو تا ۲۴ ساعت قبل با کسر ۳۰٪",
                    )
                )
    await db.flush()

    campaigns = [
        ("بهار در اصفهان", "۳ شب اقامت + تور شهری با ۲۵٪ تخفیف", img(SCENIC[2]), "مشاهده پیشنهاد", "/destinations/isfahan", "پیشنهاد فصل", 1),
        ("شب‌های شیراز", "تجربه غذا و شعر در پایتخت فرهنگی ایران", img(SCENIC[1]), "کشف شیراز", "/destinations/shiraz", "ویژه", 2),
        ("کویر یزد", "شب‌مانی زیر ستاره‌ها", img(SCENIC[4]), "رزرو تجربه", "/experiences", "ماجراجویی", 3),
        ("تعطیلات کیش", "پرواز + هتل ساحلی از ۱۲ میلیون تومان", img(SCENIC[6]), "دیدن تور", "/destinations/kish", "ساحلی", 4),
    ]
    for title, subtitle, image, cta, url, badge, order in campaigns:
        db.add(Campaign(title=title, subtitle=subtitle, image_url=image, cta_label=cta, cta_url=url, badge=badge, placement="home", sort_order=order, is_active=True))
    provider_objs["parsian-hotels"].owner_id = await _user_id_by_email(db, "provider@seir.ir")


async def _user_id_by_email(db: AsyncSession, email: str):
    return (await db.execute(select(User.id).where(User.email == email))).scalar_one_or_none()


async def seed_users(db: AsyncSession) -> dict[str, User]:
    users_data = [
        ("admin@seir.ir", "Admin12345", "مدیر سیر", Role.ADMIN),
        ("traveler@seir.ir", "Traveler123", "سارا مسافر", Role.TRAVELER),
        ("provider@seir.ir", "Provider123", "گروه پارسیان", Role.PROVIDER),
        ("support@seir.ir", "Support123", "پشتیبانی سیر", Role.SUPPORT_AGENT),
        ("marketing@seir.ir", "Marketing123", "تیم بازاریابی", Role.MARKETING_MANAGER),
    ]
    users: dict[str, User] = {}
    for email, password, name, role in users_data:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing is None:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=name,
                role=role,
                city="تهران",
                is_verified=True,
                last_login_at=NOW,
                notification_settings={"booking": True, "discount": True, "trip": True},
                privacy_settings={"show_profile": True, "share_trips": True},
            )
            db.add(user)
            await db.flush()
            db.add(UserPreference(user_id=user.id, interests=["history", "food", "nature"], budget_level="mid", travel_style="balanced"))
            db.add(Wallet(user_id=user.id, balance=0, points=0, xp=0))
        else:
            user = existing
        users[email] = user

    traveler = users["traveler@seir.ir"]
    await db.flush()
    wallet = (await db.execute(select(Wallet).where(Wallet.user_id == traveler.id))).scalar_one_or_none()
    if wallet is not None:
        wallet.balance = 12_000_000
        wallet.xp = 260
        wallet.points = 1450
        wallet.level = "silver"
        existing_tx = (await db.execute(select(func.count(WalletTransaction.id)).where(WalletTransaction.wallet_id == wallet.id))).scalar_one()
        if existing_tx == 0:
            db.add(WalletTransaction(wallet_id=wallet.id, transaction_type=WalletTransactionType.TOP_UP, amount=12_000_000, balance_after=12_000_000, description="شارژ اولیه کیف پول", reference="SEED-TOPUP"))
            db.add(WalletTransaction(wallet_id=wallet.id, transaction_type=WalletTransactionType.REWARD, amount=0, balance_after=12_000_000, description="پاداش خوش‌آمدگویی"))
    return users


async def seed_demo_activity(db: AsyncSession, users: dict[str, User]) -> None:
    traveler = users["traveler@seir.ir"]
    destinations = {d.slug: d for d in (await db.execute(select(Destination))).scalars().all()}
    accommodations = {a.slug: a for a in (await db.execute(select(Accommodation))).scalars().all()}
    experiences = {e.slug: e for e in (await db.execute(select(Experience))).scalars().all()}
    rooms = list((await db.execute(select(Room))).scalars().all())
    offers = list((await db.execute(select(TransportOffer).limit(10))).scalars().all())

    shiraz = destinations["shiraz"]
    isfahan = destinations["isfahan"]
    hotel = accommodations["zandieh"]
    room = next(r for r in rooms if r.accommodation_id == hotel.id)
    shiraz_hotel_exp = experiences["shiraz-food-tour"]

    existing_trip = (await db.execute(select(Trip).where(Trip.user_id == traveler.id, Trip.destination_id == shiraz.id))).scalar_one_or_none()
    if existing_trip is None:
        past_start = date.today() - timedelta(days=24)
        past_trip = Trip(
            user_id=traveler.id,
            destination_id=shiraz.id,
            origin_id=destinations["tehran"].id,
            title="سفر ۴ روزه به شیراز",
            status=TripStatus.COMPLETED,
            start_date=past_start,
            end_date=past_start + timedelta(days=3),
            travelers=2,
            budget=22_000_000,
            spent=18_400_000,
            budget_breakdown={"transport": 6_000_000, "accommodation": 8_200_000, "food": 2_800_000, "activities": 1_400_000},
            interests=["history", "food"],
            cover_image=shiraz.image_url,
            notes="سفر به یادماندنی با غروب حافظیه و غذای محلی.",
            is_public=True,
            share_slug="shiraz-sara-2026",
        )
        db.add(past_trip)
        await db.flush()
        for d in range(4):
            day = TripDay(trip_id=past_trip.id, day_number=d + 1, date=past_start + timedelta(days=d), title=["ورود و حافظیه", "تخت جمشید", "بازار و غذای محلی", "باغ ارم و بازگشت"][d])
            db.add(day)
            await db.flush()
            examples = [
                [("09:00", "حرکت به شیراز", "transport"), ("13:00", "ناهار در هفت‌خان", "restaurant"), ("16:30", "آرامگاه حافظ", "attraction")],
                [("08:00", "حرکت به تخت جمشید", "transport"), ("10:30", "بازدید تخت جمشید", "attraction"), ("20:00", "شب شعر حافظ", "experience")],
                [("10:00", "بازار وکیل", "attraction"), ("13:00", "تور غذای شیراز", "experience"), ("20:00", "شام محلی", "restaurant")],
                [("09:00", "باغ ارم", "attraction"), ("12:00", "تسویه هتل", "check_in")],
            ][d]
            for t, title, kind in examples:
                db.add(TripActivity(day_id=day.id, activity_type=TripActivityType(kind), title=title, start_time=time.fromisoformat(t), description="", cost=0, is_done=True))
        booking = Booking(
            code="SR-SEED01",
            user_id=traveler.id,
            trip_id=past_trip.id,
            booking_type=BookingType.ACCOMMODATION,
            status=BookingStatus.COMPLETED,
            destination_id=shiraz.id,
            accommodation_id=hotel.id,
            room_id=room.id,
            check_in=past_start,
            check_out=past_start + timedelta(days=3),
            nights=3,
            guests=2,
            rooms_count=1,
            unit_price=room.price_per_night,
            subtotal=room.price_per_night * 3,
            discount=500_000,
            total=room.price_per_night * 3 - 500_000,
            coupon_code="STAYMORE",
            title=hotel.name,
            cancellation_deadline=datetime.combine(past_start, datetime.min.time(), tzinfo=UTC) - timedelta(days=2),
            confirmed_at=NOW - timedelta(days=30),
            details={"accommodation": hotel.name, "room": room.name, "nights": 3, "guests": 2, "breakfast": True},
        )
        db.add(booking)
        await db.flush()
        db.add(Passenger(booking_id=booking.id, first_name="سارا", last_name="مسافر", national_id="0012345678", gender="female"))
        db.add(Payment(booking_id=booking.id, user_id=traveler.id, amount=booking.total, currency="IRT", method=PaymentMethod.CARD, status=PaymentStatus.PAID, reference="PAY-SEED-PAST", gateway="sandbox", paid_at=NOW - timedelta(days=30), gateway_payload={"sandbox": True, "result": "success"}))
        if offers:
            offer = next((o for o in offers if o.origin_id == destinations["tehran"].id and o.destination_id == shiraz.id), offers[0])
            transport_booking = Booking(
                code="SR-SEED02",
                user_id=traveler.id,
                trip_id=past_trip.id,
                booking_type=BookingType.TRANSPORT,
                status=BookingStatus.COMPLETED,
                destination_id=shiraz.id,
                transport_offer_id=offer.id,
                travel_date=offer.departure_at.astimezone(TEHRAN).date(),
                guests=2,
                unit_price=offer.price,
                subtotal=offer.price * 2,
                total=offer.price * 2,
                title="پرواز تهران به شیراز",
                cancellation_deadline=offer.departure_at - timedelta(hours=24),
                confirmed_at=NOW - timedelta(days=35),
                details={"provider": "ماهان ایر", "departure_at": offer.departure_at.isoformat(), "arrival_at": offer.arrival_at.isoformat()},
            )
            db.add(transport_booking)
            await db.flush()
            db.add(Passenger(booking_id=transport_booking.id, first_name="سارا", last_name="مسافر", national_id="0012345678", gender="female", seat_number="12A"))
            db.add(Payment(booking_id=transport_booking.id, user_id=traveler.id, amount=transport_booking.total, currency="IRT", method=PaymentMethod.CARD, status=PaymentStatus.PAID, reference="PAY-SEED-TRANSPORT", gateway="sandbox", paid_at=NOW - timedelta(days=35), gateway_payload={"sandbox": True, "result": "success"}))

        review1 = Review(user_id=traveler.id, entity_type=ReviewEntity.ACCOMMODATION, entity_id=hotel.id, rating=5, title="اقامتی گرم و بی‌نقص", body="پرسنل بسیار مهربان بودند و صبحانه عالی بود. نزدیک حافظیه بودن مزیت بزرگی است.", cleanliness=5, location_score=5, service=5, value=4, is_verified=True, status=ReviewStatus.PUBLISHED, helpful_count=14)
        review2 = Review(user_id=traveler.id, entity_type=ReviewEntity.EXPERIENCE, entity_id=shiraz_hotel_exp.id, rating=5, title="بهترین راه شناخت غذای شیراز", body="راهنما بسیار آگاه بود و غذاهای متنوعی را امتحان کردیم. حتماً پیشنهاد می‌کنم.", service=5, experience_score=5, is_verified=True, status=ReviewStatus.PUBLISHED, helpful_count=9)
        db.add_all([review1, review2])
        db.add_all([
            Favorite(user_id=traveler.id, entity_type=FavoriteEntity.DESTINATION, entity_id=shiraz.id),
            Favorite(user_id=traveler.id, entity_type=FavoriteEntity.ACCOMMODATION, entity_id=hotel.id),
        ])
        db.add_all([
            Notification(user_id=traveler.id, notification_type=NotificationType.TRIP_REMINDER, title="سفر شیراز شما نزدیک است", body="برنامه سفر و بلیت‌ها را در بخش سفرهای من ببینید.", data={"trip_id": str(past_trip.id)}, is_read=False),
            Notification(user_id=traveler.id, notification_type=NotificationType.DISCOUNT, title="۲۰٪ تخفیف سفر بعدی", body="کد WELCOME20 برای شما فعال شد.", data={"code": "WELCOME20"}, is_read=False),
            Notification(user_id=traveler.id, notification_type=NotificationType.REWARD, title="دستاورد جدید: کاشف طعم‌ها", body="۸۰ امتیاز تجربه دریافت کردید.", data={}, is_read=True),
        ])
        db.add_all([
            PassportStamp(user_id=traveler.id, destination_id=shiraz.id, visited_at=NOW - timedelta(days=24)),
            PassportStamp(user_id=traveler.id, destination_id=destinations["tehran"].id, visited_at=NOW - timedelta(days=90)),
        ])
        achievements = (await db.execute(select(Achievement))).scalars().all()
        achievement_map = {a.code: a for a in achievements}
        for code in ("first_destination", "first_trip", "food_explorer"):
            if code in achievement_map:
                db.add(UserAchievement(user_id=traveler.id, achievement_id=achievement_map[code].id, awarded_at=NOW - timedelta(days=30)))
        db.add(SupportTicket(user_id=traveler.id, booking_id=booking.id, subject="درخواست فاکتور رسمی", category="billing", message="برای رزرو قبلی فاکتور رسمی نیاز دارم.", status="resolved", priority="normal", response="فاکتور به ایمیل شما ارسال شد."))

        future_start = date.today() + timedelta(days=12)
        future_trip = Trip(
            user_id=traveler.id,
            destination_id=isfahan.id,
            origin_id=destinations["tehran"].id,
            title="۴ روز در اصفهان",
            status=TripStatus.UPCOMING,
            start_date=future_start,
            end_date=future_start + timedelta(days=3),
            travelers=2,
            budget=25_000_000,
            interests=["history", "food", "architecture"],
            cover_image=isfahan.image_url,
            notes="برنامه هوشمند سیر برای تعطیلات آخر هفته.",
        )
        db.add(future_trip)
        await db.flush()
        plan = await build_plan(
            db,
            PlanTripRequest(
                destination_id=isfahan.id,
                origin_id=destinations["tehran"].id,
                days=4,
                budget=25_000_000,
                travelers=2,
                interests=["history", "food"],
                start_date=future_start,
                pace="balanced",
            ),
        )
        future_trip.budget_breakdown = plan.budget_breakdown
        for plan_day in plan.days:
            day = TripDay(trip_id=future_trip.id, day_number=plan_day.day_number, date=plan_day.date, title=plan_day.title, estimated_cost=plan_day.estimated_cost)
            db.add(day)
            await db.flush()
            for activity in plan_day.activities:
                db.add(
                    TripActivity(
                        day_id=day.id,
                        activity_type=TripActivityType(activity.activity_type),
                        title=activity.title,
                        description=activity.description,
                        start_time=time.fromisoformat(activity.time),
                        end_time=time.fromisoformat(activity.end_time) if activity.end_time else None,
                        location_name=activity.location_name,
                        latitude=activity.latitude,
                        longitude=activity.longitude,
                        cost=activity.cost,
                        entity_type=activity.entity_type,
                        entity_id=activity.entity_id,
                    )
                )

    # Analytics funnel used by the admin dashboard
    event_count = (await db.execute(select(func.count(AnalyticsEvent.id)))).scalar_one()
    if event_count == 0:
        rng = random.Random(42)
        names = ["app_opened", "search_started", "destination_viewed", "hotel_viewed", "booking_started", "payment_started", "booking_completed", "review_created", "ai_plan_requested"]
        for index in range(420):
            created = NOW - timedelta(days=rng.randint(0, 30), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
            db.add(AnalyticsEvent(user_id=traveler.id if index % 3 == 0 else None, session_id=f"seed-{index % 40}", name=rng.choice(names), properties={"seed": True, "destination": rng.choice(list(destinations.keys()))}, path="/", created_at=created))


async def seed_all(db: AsyncSession, *, reset: bool = False) -> None:
    if reset:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    else:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    await seed_reference(db)
    await db.commit()
    destination_count = (await db.execute(select(func.count(Destination.id)))).scalar_one()
    if destination_count > 0:
        print("Catalog already seeded; skipping catalog/user demo data.")
        return
    users = await seed_users(db)
    await db.flush()
    await seed_catalog(db)
    await seed_demo_activity(db, users)
    await db.commit()
    print("Seed completed: 8 destinations, demo users and 30 days of inventory.")


async def main() -> None:
    reset = "--reset" in sys.argv
    async with SessionLocal() as db:
        await seed_all(db, reset=reset)


if __name__ == "__main__":
    asyncio.run(main())
