"""予約のAPIのリクエスト・レスポンスの型"""
from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


class UtcDatetimeModel(BaseModel):
    """DBのタイムゾーンなしの日時(UTC)を、末尾にZを付けて返すための土台

    Zを付けないと、ブラウザのnew Date()がその端末の時刻として読んでしまうため。
    """

    @field_serializer("*", when_used="json")
    def serialize_utc(self, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return value


class CreateReservationRequest(BaseModel):
    """POST /reservationsのリクエスト

    Attributes:
        name (str): お客様の名前
        instagram_id (str | None): InstagramのID
        phone_number (str | None): 電話番号
        menu_id (int): メニューID
        reservation_date (datetime): 開始日時。ISO8601形式(例: 2026-10-12T01:00:00.000Z)
    """
    name: str
    instagram_id: str | None = None
    phone_number: str | None = None
    menu_id: int
    reservation_date: datetime


class CreateReservationResponse(BaseModel):
    """POST /reservationsのレスポンス

    Attributes:
        message (str): 完了のメッセージ
    """
    message: str


class ReservationItem(UtcDatetimeModel):
    """GET /reservationsの1件分

    Attributes:
        start_datetime (datetime): 開始日時(UTC)
        end_datetime (datetime): 終了日時(UTC)
        menu_name (str): メニュー名
        customer_name (str): お客様の名前
    """
    start_datetime: datetime
    end_datetime: datetime
    menu_name: str
    customer_name: str


class ReservationsResponse(BaseModel):
    """GET /reservationsのレスポンス

    Attributes:
        reservations (list[ReservationItem]): 確定済みの予約
    """
    reservations: list[ReservationItem]


class HistoryItem(UtcDatetimeModel):
    """GET /historyの1件分

    Attributes:
        created_at (datetime): 予約を作った日時(UTC)
        customer_name (str): お客様の名前
        start_datetime (datetime): 開始日時(UTC)
        menu_name (str): メニュー名
    """
    created_at: datetime
    customer_name: str
    start_datetime: datetime
    menu_name: str


class HistoryResponse(BaseModel):
    """GET /historyのレスポンス

    Attributes:
        history (list[HistoryItem]): 新しい順の予約
    """
    history: list[HistoryItem]
