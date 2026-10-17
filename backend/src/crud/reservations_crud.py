"""予約の読み書き。例外は投げない。コミットもしない"""
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from src.models import Reservation

CONFIRMED = "confirmed"
CANCELLED = "cancelled"


def count_reservations(db: Session) -> int:
    """予約の件数を数える

    Args:
        db (Session): DBのセッション

    Returns:
        int: 予約の件数
    """
    return db.query(func.count(Reservation.id)).scalar()


def get_reservation_by_id(db: Session, reservation_id: int) -> Reservation | None:
    """予約IDで予約を1件探す。取り消し済みの予約も返す

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID

    Returns:
        Reservation | None: 見つかった予約。なければNone
    """
    return db.get(Reservation, reservation_id)


def get_confirmed_reservations(db: Session) -> list[Reservation]:
    """確定済みの予約をすべて返す。メニューも一緒に読み込む

    Args:
        db (Session): DBのセッション

    Returns:
        list[Reservation]: 確定済みの予約
    """
    return (
        db.query(Reservation)
        .options(joinedload(Reservation.menu))
        .filter(Reservation.status == CONFIRMED)
        .all()
    )


def get_latest_reservations(db: Session, limit: int) -> list[Reservation]:
    """作成日時が新しい順に予約を返す。メニューも一緒に読み込む

    Args:
        db (Session): DBのセッション
        limit (int): 返す件数

    Returns:
        list[Reservation]: 新しい順の予約
    """
    return (
        db.query(Reservation)
        .options(joinedload(Reservation.menu))
        .order_by(Reservation.created_at.desc())
        .limit(limit)
        .all()
    )


def count_overlapping_reservations(
    db: Session, start: datetime, end: datetime, exclude_id: int | None = None
) -> int:
    """[start, end)と時間が重なる確定済みの予約を数える

    Args:
        db (Session): DBのセッション
        start (datetime): 開始日時(UTC、タイムゾーンなし)
        end (datetime): 終了日時(UTC、タイムゾーンなし)
        exclude_id (int | None): 数えない予約のID。予約を変更する時に、その予約自身を除くのに使う

    Returns:
        int: 重なる予約の件数
    """
    query = db.query(func.count(Reservation.id)).filter(
        Reservation.status == CONFIRMED,
        Reservation.start_datetime < end,
        Reservation.end_datetime > start,
    )
    if exclude_id is not None:
        query = query.filter(Reservation.id != exclude_id)
    return query.scalar()


def create_reservation(
    db: Session,
    customer_name: str,
    instagram_id: str | None,
    phone_number: str | None,
    menu_id: int,
    start: datetime,
    end: datetime,
    created_at: datetime,
) -> Reservation:
    """予約を追加する。db.addだけ行い、コミットしない

    Args:
        db (Session): DBのセッション
        customer_name (str): お客様の名前
        instagram_id (str | None): InstagramのID
        phone_number (str | None): 電話番号
        menu_id (int): メニューID
        start (datetime): 開始日時(UTC、タイムゾーンなし)
        end (datetime): 終了日時(UTC、タイムゾーンなし)
        created_at (datetime): 作成日時(UTC、タイムゾーンなし)

    Returns:
        Reservation: 追加した予約
    """
    reservation = Reservation(
        customer_name=customer_name,
        instagram_id=instagram_id,
        phone_number=phone_number,
        menu_id=menu_id,
        start_datetime=start,
        end_datetime=end,
        status=CONFIRMED,
        created_at=created_at,
    )
    db.add(reservation)
    return reservation
