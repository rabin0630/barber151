"""reservation_serviceの単体テスト"""
from datetime import datetime, timedelta, timezone

from src.services.reservation_service import to_utc_naive


def test_to_utc_naive_from_aware():
    # タイムゾーンつきの日時は、UTCに直してタイムゾーンを外す
    jst = timezone(timedelta(hours=9))

    assert to_utc_naive(datetime(2026, 10, 12, 10, 0, tzinfo=jst)) == datetime(2026, 10, 12, 1, 0)


def test_to_utc_naive_from_naive():
    # タイムゾーンなしの日時は、そのまま返す
    assert to_utc_naive(datetime(2026, 10, 12, 1, 0)) == datetime(2026, 10, 12, 1, 0)
