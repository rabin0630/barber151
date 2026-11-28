"""日時の変換(DBにはUTCのタイムゾーンなしで保存する)"""
from datetime import datetime, timezone


def to_utc_naive(value: datetime) -> datetime:
    """日時をUTCのタイムゾーンなしにする。DBにはこの形で保存する

    タイムゾーンなしの日時は、すでにUTCとみなす。

    Args:
        value (datetime): 変換する日時

    Returns:
        datetime: UTCのタイムゾーンなしの日時
    """
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def now_utc() -> datetime:
    """今のUTCの日時を、タイムゾーンなしで返す

    Returns:
        datetime: 今のUTCの日時
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
