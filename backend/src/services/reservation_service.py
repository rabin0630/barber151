"""予約のルール(連絡先の必須チェック、重複チェック)と、予約の登録・取得の処理"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.exceptions import AppError
from src.models import Reservation

HISTORY_LIMIT = 10


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


def list_confirmed_reservations(db: Session) -> list[Reservation]:
    """確定済みの予約をすべて返す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Reservation]: 確定済みの予約
    """
    return reservations_crud.get_confirmed_reservations(db)


def list_history(db: Session) -> list[Reservation]:
    """新しく作られた順に、予約をHISTORY_LIMIT件返す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Reservation]: 新しい順の予約
    """
    return reservations_crud.get_latest_reservations(db, HISTORY_LIMIT)


def create_reservation(
    db: Session,
    customer_name: str,
    instagram_id: str | None,
    phone_number: str | None,
    menu_id: int,
    reservation_date: datetime,
) -> Reservation:
    """予約を登録する

    連絡先・メニュー・重複の順に確かめてから登録し、コミットする。

    Args:
        db (Session): DBのセッション
        customer_name (str): お客様の名前
        instagram_id (str | None): InstagramのID
        phone_number (str | None): 電話番号
        menu_id (int): メニューID
        reservation_date (datetime): 開始日時

    Returns:
        Reservation: 登録した予約

    Raises:
        AppError: 登録できない時(400)。次のどれか
            - InstagramのIDも電話番号もない
            - メニューIDがない、または削除済み
            - 他の予約と時間が重なる
    """
    if not instagram_id and not phone_number:
        raise AppError(400, "Instagram ID または 電話番号のどちらかを入力してください。")

    menu = menus_crud.get_menu_by_id(db, menu_id)
    if menu is None or not menu.is_active:
        raise AppError(400, "無効なメニューです。")

    start = to_utc_naive(reservation_date)
    end = start + timedelta(hours=menu.duration)

    if reservations_crud.count_overlapping_reservations(db, start, end) > 0:
        raise AppError(400, "申し訳ありません。この時間はすでに予約が埋まっています。")

    reservation = reservations_crud.create_reservation(
        db, customer_name, instagram_id, phone_number, menu_id, start, end, now_utc()
    )
    db.commit()
    db.refresh(reservation)
    return reservation
