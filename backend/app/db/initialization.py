from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.db.session import engine, Base
from app.models.user import User
from app.models.menu import MenuVersion, MenuMealEntry, DishItem
from app.models.meal import MealInstance
from app.models.schedule import NotificationSchedule
from app.models.notification import Notification
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.outcome import MealOutcome
from app.core.security import hash_password
from app.core.config import settings
from app.core.timezone import calculate_meal_response_window, evaluate_meal_window_status

DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"]

# Default Schedule timings
SCHEDULE_DEFAULTS = [
    {"meal_type": "BREAKFAST", "send": "21:00", "deadline": "22:00", "offset": 1},
    {"meal_type": "LUNCH", "send": "08:00", "deadline": "09:30", "offset": 0},
    {"meal_type": "SNACKS", "send": "12:00", "deadline": "14:00", "offset": 0},
    {"meal_type": "DINNER", "send": "15:00", "deadline": "17:00", "offset": 0},
]

# Raw Menu Data from IIIT DWD MESS MENU - MESS 1.pdf
INITIAL_MENU_RAW = [
    # MONDAY
    {
        "day": "MONDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Pongal", "alts": ["Poha with sev"], "cat": "main"},
            {"name": "Chutney", "alts": None, "cat": "accompaniment"},
            {"name": "Black Chana Sprouts", "alts": None, "cat": "side"},
            {"name": "Boiled Egg", "alts": None, "cat": "protein"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": ["Pongal / Poha with Sev: alternating weeks (Note 1)"]
    },
    {
        "day": "MONDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Curd Rice", "alts": None, "cat": "rice"},
            {"name": "Dal Methi", "alts": None, "cat": "dal"},
            {"name": "Brinjal Bhartha", "alts": None, "cat": "sabzi"},
            {"name": "Chapati", "alts": ["Fulka"], "cat": "bread"},
            {"name": "Buttermilk", "alts": None, "cat": "beverage"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Chapati / Fulka: alternating weeks (Note 1)", "Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "MONDAY", "meal": "SNACKS",
        "dishes": [{"name": "Samosa", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Fruit limitations apply (Note 2)"]
    },
    {
        "day": "MONDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Kadai Paneer", "alts": None, "cat": "sabzi"},
            {"name": "Rasam", "alts": None, "cat": "soup"},
            {"name": "Dal Pancharatan", "alts": None, "cat": "dal"},
            {"name": "Sheera (Rava)", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Sweet limitation applies to Sheera (Note 2)"]
    },

    # TUESDAY
    {
        "day": "TUESDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Upma", "alts": ["Sewaiya Upma"], "cat": "main"},
            {"name": "Sheera", "alts": None, "cat": "sweet"},
            {"name": "Chutney", "alts": None, "cat": "accompaniment"},
            {"name": "Boiled Groundnut", "alts": None, "cat": "side"},
            {"name": "Egg Bhurji", "alts": None, "cat": "protein"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": ["Upma / Sewaiya Upma: alternating weeks (Note 1)"]
    },
    {
        "day": "TUESDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Veg Pulav", "alts": None, "cat": "rice"},
            {"name": "Dal Tadka", "alts": None, "cat": "dal"},
            {"name": "White Peas Masala", "alts": None, "cat": "sabzi"},
            {"name": "Puri", "alts": None, "cat": "bread"},
            {"name": "Lemonade", "alts": None, "cat": "beverage"},
            {"name": "Curd", "alts": None, "cat": "accompaniment"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "TUESDAY", "meal": "SNACKS",
        "dishes": [{"name": "Pani Puri", "alts": None, "cat": "snack"}],
        "accompaniments": ["Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["No Red/Green Chutney on Tuesday", "Fruit limitations apply (Note 2)"]
    },
    {
        "day": "TUESDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Khichadi", "alts": ["Bisibele Bath with Boondi"], "cat": "rice"},
            {"name": "Bhendi Sabji", "alts": None, "cat": "sabzi"},
            {"name": "Veg Kadai", "alts": None, "cat": "sabzi"},
            {"name": "Channa Dal", "alts": None, "cat": "dal"},
            {"name": "Ice Cream (Variety of Flavours)", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Ice Cream: maximum 1 cup (Note 2)"]
    },

    # WEDNESDAY
    {
        "day": "WEDNESDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Idli", "alts": None, "cat": "main"},
            {"name": "Vada", "alts": None, "cat": "main"},
            {"name": "Sambar & Chutney", "alts": None, "cat": "accompaniment"},
            {"name": "Matki Sprouts", "alts": None, "cat": "side"},
            {"name": "Boiled Egg", "alts": None, "cat": "protein"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": []
    },
    {
        "day": "WEDNESDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Onion Rice", "alts": None, "cat": "rice"},
            {"name": "Dal Makhani", "alts": None, "cat": "dal"},
            {"name": "Jeera Aloo", "alts": None, "cat": "sabzi"},
            {"name": "Chawli Masala", "alts": None, "cat": "sabzi"},
            {"name": "Chapati", "alts": ["Fulka"], "cat": "bread"},
            {"name": "Jaljeera", "alts": None, "cat": "beverage"},
            {"name": "Curd", "alts": None, "cat": "accompaniment"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Chapati / Fulka: alternating weeks (Note 1)", "Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "WEDNESDAY", "meal": "SNACKS",
        "dishes": [{"name": "Punugulu & Chutney", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Punugulu limitation applies (Note 2)", "Fruit limitations apply (Note 2)"]
    },
    {
        "day": "WEDNESDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Soyabean Biryani", "alts": None, "cat": "rice"},
            {"name": "Paneer Kholapuri", "alts": None, "cat": "sabzi"},
            {"name": "Rasam", "alts": None, "cat": "soup"},
            {"name": "Raita", "alts": None, "cat": "accompaniment"},
            {"name": "Masoor Dal", "alts": None, "cat": "dal"},
            {"name": "Shevai Kheer", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Sweet limitation applies to Shevai Kheer (Note 2)"]
    },

    # THURSDAY
    {
        "day": "THURSDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Aloo Paratha", "alts": None, "cat": "main"},
            {"name": "Chutney & Curd", "alts": None, "cat": "accompaniment"},
            {"name": "Boiled Sweet Corn", "alts": None, "cat": "side"},
            {"name": "Boiled Egg", "alts": None, "cat": "protein"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": []
    },
    {
        "day": "THURSDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Puliogare", "alts": None, "cat": "rice"},
            {"name": "Dal Fry", "alts": None, "cat": "dal"},
            {"name": "Brinjal Tomato", "alts": None, "cat": "sabzi"},
            {"name": "Kadhi Pakoda", "alts": None, "cat": "sabzi"},
            {"name": "Chapati", "alts": ["Fulka"], "cat": "bread"},
            {"name": "Lassi", "alts": None, "cat": "beverage"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Chapati / Fulka: alternating weeks (Note 1)", "Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "THURSDAY", "meal": "SNACKS",
        "dishes": [{"name": "Veg Noodles", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Fruit limitations apply (Note 2)"]
    },
    {
        "day": "THURSDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Onion Rice", "alts": None, "cat": "rice"},
            {"name": "Ivy Gourd Fry", "alts": None, "cat": "sabzi"},
            {"name": "Cabbage Baji", "alts": None, "cat": "sabzi"},
            {"name": "Dal", "alts": None, "cat": "dal"},
            {"name": "Mothichoor Ladoo", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Sweet limitation applies to Mothichoor Ladoo (Note 2)"]
    },

    # FRIDAY
    {
        "day": "FRIDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Masala Dosa", "alts": None, "cat": "main"},
            {"name": "Sambar & Chutney", "alts": None, "cat": "accompaniment"},
            {"name": "Green Moong Sprouts", "alts": None, "cat": "side"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": ["No egg on Friday breakfast (Source: *** in egg row)"]
    },
    {
        "day": "FRIDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Veg & Egg Biryani", "alts": None, "cat": "rice"},
            {"name": "Mix Veg Raita", "alts": None, "cat": "accompaniment"},
            {"name": "Black Channa Masala", "alts": None, "cat": "sabzi"},
            {"name": "Chapati", "alts": ["Fulka"], "cat": "bread"},
            {"name": "Lemon Juice", "alts": None, "cat": "beverage"},
            {"name": "Curd", "alts": None, "cat": "accompaniment"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Chapati / Fulka: alternating weeks (Note 1)", "Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "FRIDAY", "meal": "SNACKS",
        "dishes": [{"name": "Pasta", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Fruit limitations apply (Note 2)"]
    },
    {
        "day": "FRIDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Tomato Rice", "alts": None, "cat": "rice"},
            {"name": "Aloo 65", "alts": None, "cat": "sabzi"},
            {"name": "Soyabean Sabzi Gravy", "alts": None, "cat": "sabzi"},
            {"name": "Dal Tadka", "alts": None, "cat": "dal"},
            {"name": "Gulab Jamun", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Sweet limitation applies to Gulab Jamun (Note 2)"]
    },

    # SATURDAY
    {
        "day": "SATURDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Uthappam", "alts": None, "cat": "main"},
            {"name": "Chutney", "alts": ["Coconut Chutney"], "cat": "accompaniment"},
            {"name": "Matki Sprouts", "alts": None, "cat": "side"},
            {"name": "Egg Bhurji", "alts": None, "cat": "protein"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": ["Chutney / Coconut Chutney: alternating weeks (Note 1)"]
    },
    {
        "day": "SATURDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Curd Rice", "alts": None, "cat": "rice"},
            {"name": "Dal Palak", "alts": None, "cat": "dal"},
            {"name": "Chole Bhature", "alts": None, "cat": "bread"},
            {"name": "Hot Badam Milk", "alts": None, "cat": "beverage"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "SATURDAY", "meal": "SNACKS",
        "dishes": [{"name": "Masala Bhel", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Fruit limitations apply (Note 2)"]
    },
    {
        "day": "SATURDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Jeera Rice", "alts": None, "cat": "rice"},
            {"name": "Curd", "alts": None, "cat": "accompaniment"},
            {"name": "Shahi Paneer", "alts": None, "cat": "sabzi"},
            {"name": "Dal Kholapuri", "alts": None, "cat": "dal"},
            {"name": "Ice Cream (Variety of Flavours)", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Ice Cream: maximum 1 cup (Note 2)"]
    },

    # SUNDAY
    {
        "day": "SUNDAY", "meal": "BREAKFAST",
        "dishes": [
            {"name": "Vangi Bath", "alts": None, "cat": "main"},
            {"name": "Aloo Mutter Sabzi", "alts": None, "cat": "sabzi"},
            {"name": "Green Moong Sprouts", "alts": None, "cat": "side"},
        ],
        "accompaniments": ["Fruits / Cornflakes", "BBJ - Bread Butter Jam", "Tea, Coffee, Milk, Bournvita / Horlicks"],
        "notes": ["No egg on Sunday breakfast (Source: *** in egg row)"]
    },
    {
        "day": "SUNDAY", "meal": "LUNCH",
        "dishes": [
            {"name": "Moong Dal", "alts": None, "cat": "dal"},
            {"name": "Paneer Butter Masala", "alts": None, "cat": "sabzi"},
            {"name": "Egg Curry", "alts": None, "cat": "protein"},
            {"name": "Chapati", "alts": ["Fulka"], "cat": "bread"},
            {"name": "Rasna", "alts": None, "cat": "beverage"},
        ],
        "accompaniments": ["Plain Rice", "Pickle", "Papad", "Mix Salad", "Green Chilli / Lemon Slice"],
        "notes": ["Chapati / Fulka: alternating weeks (Note 1)", "Afternoon eggs limited to 2 (Note 3)"]
    },
    {
        "day": "SUNDAY", "meal": "SNACKS",
        "dishes": [{"name": "Girmit (Bhel)", "alts": None, "cat": "snack"}],
        "accompaniments": ["Red Chutney & Green Chutney", "Fruits", "BBJ - Bread Butter Jam", "Ginger Tea, Milk, Bournvita / Horlicks"],
        "notes": ["Fruit limitations apply (Note 2)"]
    },
    {
        "day": "SUNDAY", "meal": "DINNER",
        "dishes": [
            {"name": "Sorakay Chana", "alts": None, "cat": "sabzi"},
            {"name": "Veg Kholapuri", "alts": None, "cat": "sabzi"},
            {"name": "Moong Dal", "alts": None, "cat": "dal"},
            {"name": "Jalebi", "alts": None, "cat": "dessert"},
        ],
        "accompaniments": ["Plain Rice", "Chapati / Fulka", "Mix Salad", "Pickle", "Green Chilli / Lemon Slice"],
        "notes": ["Sweet limitation applies to Jalebi (Note 2)"]
    },
]

def init_db(db: Session) -> None:
    """Initialize database tables and seed baseline demo records idempotently."""
    Base.metadata.create_all(bind=engine)

    # Ensure response_open_time column exists in SQLite meal_instances
    try:
        from sqlalchemy import text
        db.execute(text("ALTER TABLE meal_instances ADD COLUMN response_open_time VARCHAR(64)"))
        db.commit()
    except Exception:
        db.rollback()

    # 1. Seed Demo Users (development and demonstration only; never in production)
    if not db.query(User).first() and settings.ENVIRONMENT.lower() != "production":
        demo_users = [
            User(
                id="user-student-arjun",
                display_name="Arjun Sharma",
                email="arjun@iiitdwd.ac.in",
                hashed_password=hash_password("demo123"),
                role="STUDENT",
                status="ACTIVE",
            ),
            User(
                id="user-student-priya",
                display_name="Priya Patel",
                email="priya@iiitdwd.ac.in",
                hashed_password=hash_password("demo123"),
                role="STUDENT",
                status="ACTIVE",
            ),
            User(
                id="user-student-rahul",
                display_name="Rahul Verma",
                email="rahul@iiitdwd.ac.in",
                hashed_password=hash_password("demo123"),
                role="STUDENT",
                status="ACTIVE",
            ),
            User(
                id="user-vendor",
                display_name="Mess Vendor",
                email="vendor@iiitdwd.ac.in",
                hashed_password=hash_password("demo123"),
                role="VENDOR",
                status="ACTIVE",
            ),
            User(
                id="user-admin",
                display_name="Admin User",
                email="admin@iiitdwd.ac.in",
                hashed_password=hash_password("demo123"),
                role="ADMIN",
                status="ACTIVE",
            ),
        ]
        db.add_all(demo_users)
        db.commit()

    # 2. Seed Published Menu Version 1
    if not db.query(MenuVersion).first():
        v1 = MenuVersion(
            id="menu-v1",
            version_number=1,
            status="PUBLISHED",
            change_summary="Initial published menu from IIIT Dharwad Mess 1 source PDF",
            created_at=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc),
            published_at=datetime(2026, 10, 1, 10, 30, tzinfo=timezone.utc),
        )
        db.add(v1)
        db.commit()

        # Seed the 28 meal entries
        dish_counter = 0
        for entry_data in INITIAL_MENU_RAW:
            meal_entry_id = f"entry-v1-{entry_data['day'].lower()}-{entry_data['meal'].lower()}"
            meal_entry = MenuMealEntry(
                id=meal_entry_id,
                menu_version_id="menu-v1",
                day_of_week=entry_data["day"],
                meal_type=entry_data["meal"],
                accompaniments=entry_data["accompaniments"],
                notes=entry_data["notes"],
            )
            db.add(meal_entry)
            db.commit()

            for dish_data in entry_data["dishes"]:
                dish_counter += 1
                dish = DishItem(
                    id=f"dish-{dish_counter}",
                    menu_meal_entry_id=meal_entry_id,
                    name=dish_data["name"],
                    alternatives=dish_data["alts"],
                    category=dish_data["cat"],
                )
                db.add(dish)
        db.commit()

    # 3. Seed 28 Notification Schedules
    if not db.query(NotificationSchedule).first():
        schedules = []
        for day in DAYS:
            for s_def in SCHEDULE_DEFAULTS:
                s_id = f"schedule-{day.lower()}-{s_def['meal_type'].lower()}"
                schedules.append(
                    NotificationSchedule(
                        id=s_id,
                        day_of_week=day,
                        meal_type=s_def["meal_type"],
                        enabled=True,
                        notify_send_time=s_def["send"],
                        response_deadline_time=s_def["deadline"],
                        meal_date_offset=s_def["offset"],
                        timezone="Asia/Kolkata",
                        overlap_acknowledged=False,
                    )
                )
        db.add_all(schedules)
        db.commit()

    # 4. Seed Meal Instances for Current Period (relative to today)
    if not db.query(MealInstance).first():
        today = datetime.now(timezone.utc)
        instances = []
        # Create instances for yesterday, today, and next 5 days
        for offset in range(-1, 6):
            target_date = today + timedelta(days=offset)
            date_str = target_date.strftime("%Y-%m-%d")

            for m_type in MEAL_TYPES:
                inst_id = f"mi-{date_str}-{m_type.lower()}"
                open_utc, close_utc, open_iso, close_iso = calculate_meal_response_window(
                    meal_date=date_str,
                    meal_type=m_type,
                    tz="Asia/Kolkata",
                )

                if offset < 0:
                    status = "COMPLETED"
                else:
                    status = evaluate_meal_window_status(datetime.now(timezone.utc), open_utc, close_utc)

                instances.append(
                    MealInstance(
                        id=inst_id,
                        meal_date=date_str,
                        meal_type=m_type,
                        menu_version_id="menu-v1",
                        response_deadline=close_iso,
                        response_open_time=open_iso,
                        status=status,
                    )
                )
        db.add_all(instances)
        db.commit()

    # 5. Seed Notifications
    if not db.query(Notification).first():
        demo_notifs = [
            Notification(
                id="notif-1",
                title="Welcome to MessMate API!",
                message="Connected to FastAPI backend with SQLite persistence.",
                is_read=False,
                created_at=datetime.now(timezone.utc),
            ),
            Notification(
                id="notif-2",
                title="Meal Intention Reminders Active",
                message="Please submit your intentions before meal deadlines to help the mess plan accurately.",
                is_read=False,
                created_at=datetime.now(timezone.utc),
            ),
        ]
        db.add_all(demo_notifs)
        db.commit()
