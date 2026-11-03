"""
MessMate Timezone Architecture Service
======================================
Provides authoritative institutional timezone resolution, date derivation,
UTC timestamp standardization, and cross-timezone instant conversions using
Python's standard `zoneinfo.ZoneInfo`.
"""

from datetime import datetime, date, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional, Union, Tuple
from app.core.config import settings


def validate_timezone_name(tz_name: str) -> str:
    """
    Validates that a string is a valid, recognized IANA timezone identifier.
    Raises ValueError with actionable instructions if unrecognized.
    """
    if not tz_name or not isinstance(tz_name, str):
        raise ValueError("Timezone identifier must be a non-empty string.")
    
    clean_tz = tz_name.strip()
    if not clean_tz:
        raise ValueError("Timezone identifier cannot be empty or whitespace.")

    try:
        ZoneInfo(clean_tz)
    except Exception as exc:
        raise ValueError(
            f"Invalid IANA timezone name: '{clean_tz}'. "
            f"Expected recognized zone such as 'Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'."
        ) from exc

    return clean_tz


def get_institution_timezone(tz_name: Optional[str] = None) -> ZoneInfo:
    """
    Resolves a ZoneInfo instance for the institution.
    Defaults to settings.TIMEZONE ("Asia/Kolkata") if not explicitly provided.
    """
    target = tz_name if (tz_name and tz_name.strip()) else settings.TIMEZONE
    clean = validate_timezone_name(target)
    return ZoneInfo(clean)


def now_utc() -> datetime:
    """Returns the current instant as a UTC-aware datetime."""
    return datetime.now(timezone.utc)


def get_institution_now(tz: Union[ZoneInfo, str]) -> datetime:
    """
    Returns the current instant localized in the institution's timezone.
    For example, at 20:30 UTC on Nov 3, this returns 02:00 IST on Nov 4.
    """
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    return datetime.now(zone)


def get_institution_today_str(tz: Union[ZoneInfo, str]) -> str:
    """
    Returns today's institutional calendar date as YYYY-MM-DD in the institution's timezone.
    Guarantees correct calendar day across midnight relative to UTC.
    """
    return get_institution_now(tz).strftime("%Y-%m-%d")


def parse_as_aware(
    iso_string: str, default_tz: Union[ZoneInfo, str] = "Asia/Kolkata"
) -> datetime:
    """
    Parses an ISO 8601 string into a timezone-aware datetime.
    If the string does not specify an offset (naive), localizes it to default_tz.
    If already aware, preserves the instant.
    """
    dt = datetime.fromisoformat(iso_string)
    if dt.tzinfo is None:
        zone = default_tz if isinstance(default_tz, ZoneInfo) else ZoneInfo(default_tz)
        dt = dt.replace(tzinfo=zone)
    return dt


def to_utc(dt: datetime) -> datetime:
    """Converts any timezone-aware datetime to UTC."""
    if dt.tzinfo is None:
        raise ValueError("Cannot convert naive datetime to UTC without an explicit timezone.")
    return dt.astimezone(timezone.utc)


def local_date_and_time_to_utc(
    date_str: str, time_str: str, tz: Union[ZoneInfo, str]
) -> datetime:
    """
    Combines an institution-local date (YYYY-MM-DD) and local time (HH:MM)
    into an aware datetime in `tz`, then converts it to UTC.
    Correctly accounts for DST transitions.
    """
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    d = date.fromisoformat(date_str)
    parts = time_str.split(":")
    t = time(hour=int(parts[0]), minute=int(parts[1]))
    local_dt = datetime.combine(d, t, tzinfo=zone)
    return to_utc(local_dt)


def get_utc_interval_for_local_date(
    date_str: str, tz: Union[ZoneInfo, str]
) -> Tuple[datetime, datetime]:
    """
    Returns the exact UTC [start_utc, end_utc] interval covering a full
    institution-local calendar date (from 00:00:00 to 23:59:59.999999).
    """
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    d = date.fromisoformat(date_str)
    start_local = datetime.combine(d, time.min, tzinfo=zone)
    end_local = datetime.combine(d, time.max, tzinfo=zone)
    return to_utc(start_local), to_utc(end_local)


DEFAULT_SCHEDULE_TIMINGS = {
    "BREAKFAST": {"send": "21:00", "deadline": "22:00", "offset": 1},
    "LUNCH": {"send": "08:00", "deadline": "09:30", "offset": 0},
    "SNACKS": {"send": "12:00", "deadline": "14:00", "offset": 0},
    "DINNER": {"send": "15:00", "deadline": "17:00", "offset": 0},
}


def calculate_meal_response_window(
    meal_date: str,
    meal_type: str,
    response_open_time: Optional[str] = None,
    response_deadline: Optional[str] = None,
    schedule: Optional[object] = None,
    tz: Union[ZoneInfo, str] = "Asia/Kolkata",
) -> Tuple[datetime, datetime, str, str]:
    """
    Calculates the exact UTC aware instants for a meal's response opening and closing window,
    along with their institutional ISO formatted representations.
    Returns: (open_utc, close_utc, open_iso, close_iso)
    """
    from datetime import timedelta
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    d = date.fromisoformat(meal_date)
    m_type = meal_type.upper()
    default_timing = DEFAULT_SCHEDULE_TIMINGS.get(m_type, {"send": "08:00", "deadline": "09:30", "offset": 0})

    # 1. Opening instant
    if response_open_time and response_open_time.strip():
        open_dt = parse_as_aware(response_open_time, default_tz=zone)
        open_utc = to_utc(open_dt)
        open_iso = open_dt.astimezone(zone).isoformat()
    else:
        send_time = getattr(schedule, "notify_send_time", None) if schedule else None
        offset = getattr(schedule, "meal_date_offset", None) if schedule else None
        if not send_time:
            send_time = default_timing["send"]
        if offset is None:
            offset = default_timing["offset"]
        open_date = d - timedelta(days=int(offset))
        open_utc = local_date_and_time_to_utc(open_date.strftime("%Y-%m-%d"), send_time, zone)
        open_iso = open_utc.astimezone(zone).isoformat()

    # 2. Closing deadline instant
    if response_deadline and response_deadline.strip():
        close_dt = parse_as_aware(response_deadline, default_tz=zone)
        close_utc = to_utc(close_dt)
        close_iso = close_dt.astimezone(zone).isoformat()
    else:
        deadline_time = getattr(schedule, "response_deadline_time", None) if schedule else None
        offset = getattr(schedule, "meal_date_offset", None) if schedule else None
        if not deadline_time:
            deadline_time = default_timing["deadline"]
        if offset is None:
            offset = default_timing["offset"]
        close_date = d - timedelta(days=int(offset))
        close_utc = local_date_and_time_to_utc(close_date.strftime("%Y-%m-%d"), deadline_time, zone)
        close_iso = close_utc.astimezone(zone).isoformat()

    return open_utc, close_utc, open_iso, close_iso


def evaluate_meal_window_status(now_utc_instant: datetime, open_utc: datetime, close_utc: datetime) -> str:
    """
    Authoritative state evaluation based strictly on:
    opening_time <= current_time < closing_time
    - now < open_utc: 'UPCOMING'
    - open_utc <= now < close_utc: 'RESPONSE_OPEN'
    - now >= close_utc: 'RESPONSE_CLOSED'
    """
    if now_utc_instant >= close_utc:
        return "RESPONSE_CLOSED"
    if now_utc_instant < open_utc:
        return "UPCOMING"
    return "RESPONSE_OPEN"
