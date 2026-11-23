"""予約のルール(連絡先の必須チェック、重複チェック)と、予約の登録・取得の処理"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.exceptions import AppError
from src.models import Reservation
from src.services.cleaners import ExpiredReservationCleaner
from src.services.contacts import normalize_contacts
from src.time_utils import now_utc, to_utc_naive

HISTORY_LIMIT = 10

def list_confirmed_reservations(db: Session, cleaner: ExpiredReservationCleaner) -> list[Reservation]:
    """確定済みの予約をすべて返す。期限切れの予約は先に消す

    Args:
        db (Session): DBのセッション
        cleaner (ExpiredReservationCleaner): 期限切れの予約の掃除

    Returns:
        list[Reservation]: 確定済みの予約
    """
    cleaner.delete_expired(db)
    return reservations_crud.get_confirmed_reservations(db)


def list_history(db: Session, cleaner: ExpiredReservationCleaner) -> list[Reservation]:
    """新しく作られた順に、予約をHISTORY_LIMIT件返す。期限切れの予約は先に消す

    Args:
        db (Session): DBのセッション
        cleaner (ExpiredReservationCleaner): 期限切れの予約の掃除

    Returns:
        list[Reservation]: 新しい順の予約
    """
    cleaner.delete_expired(db)
    return reservations_crud.get_latest_reservations(db, HISTORY_LIMIT)


def create_reservation(
    db: Session,
    cleaner: ExpiredReservationCleaner,
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
        cleaner (ExpiredReservationCleaner): 期限切れの予約の掃除
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
            - InstagramのIDか電話番号の形式が正しくない
            - メニューIDがない、または削除済み
            - 他の予約と時間が重なる
    """
    instagram_id, phone_number = normalize_contacts(instagram_id, phone_number)

    menu = menus_crud.get_menu_by_id(db, menu_id)
    if menu is None or not menu.is_active:
        raise AppError(400, "無効なメニューです。")

    start = to_utc_naive(reservation_date)
    end = start + timedelta(hours=menu.duration)

    # デモ中に時間が過ぎた予約の枠は、また予約できるようにする
    cleaner.delete_expired(db)
    if reservations_crud.count_overlapping_reservations(db, start, end) > 0:
        raise AppError(400, "申し訳ありません。この時間はすでに予約が埋まっています。")

    reservation = reservations_crud.create_reservation(
        db, customer_name, instagram_id, phone_number, menu_id, start, end, now_utc()
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def get_confirmed_reservation(db: Session, reservation_id: int) -> Reservation:
    """確定済みの予約を1件返す

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID

    Returns:
        Reservation: 確定済みの予約

    Raises:
        AppError: 予約がない、またはすでに取り消し済みの時(404)
    """
    reservation = reservations_crud.get_reservation_by_id(db, reservation_id)
    if reservation is None or reservation.status != reservations_crud.CONFIRMED:
        raise AppError(404, "予約が見つかりません。")
    return reservation


def change_reservation_menu(db: Session, reservation_id: int, menu_id: int) -> Reservation:
    """予約のメニューを変え、終了日時をメニューの所要時間に合わせて、コミットする

    開始日時はそのまま。長くなって次の予約と重なる時は変えない。

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID
        menu_id (int): 新しいメニューID

    Returns:
        Reservation: 変更した予約

    Raises:
        AppError: 変更できない時。次のどれか
            - 予約がない、またはすでに取り消し済み(404)
            - メニューIDがない、または削除済み(400)
            - 長くなった分が、他の予約と重なる(409)
    """
    reservation = get_confirmed_reservation(db, reservation_id)

    menu = menus_crud.get_menu_by_id(db, menu_id)
    if menu is None or not menu.is_active:
        raise AppError(400, "無効なメニューです。")

    end = reservation.start_datetime + timedelta(hours=menu.duration)
    if reservations_crud.count_overlapping_reservations(
        db, reservation.start_datetime, end, exclude_id=reservation.id
    ) > 0:
        raise AppError(409, "このあと予約している人がいるため延長できません。")

    reservation.menu_id = menu.id
    reservation.end_datetime = end
    db.commit()
    db.refresh(reservation)
    return reservation


def change_reservation_contacts(
    db: Session, reservation_id: int, instagram_id: str | None, phone_number: str | None
) -> Reservation:
    """予約のInstagramのIDと電話番号を書き換え、コミットする

    予約した時と同じルールで確かめる。どちらかは残っていないといけない。

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID
        instagram_id (str | None): 新しいInstagramのID。空なら消す
        phone_number (str | None): 新しい電話番号。空なら消す

    Returns:
        Reservation: 変更した予約

    Raises:
        AppError: 変更できない時。次のどれか
            - 予約がない、またはすでに取り消し済み(404)
            - InstagramのIDも電話番号もなくなる、または形式が正しくない(400)
    """
    reservation = get_confirmed_reservation(db, reservation_id)
    reservation.instagram_id, reservation.phone_number = normalize_contacts(instagram_id, phone_number)
    db.commit()
    db.refresh(reservation)
    return reservation


def change_reservation_name(db: Session, reservation_id: int, customer_name: str) -> Reservation:
    """予約のお客様の名前を書き換え、コミットする。前後の空白は取り除く

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID
        customer_name (str): 新しい名前

    Returns:
        Reservation: 変更した予約

    Raises:
        AppError: 変更できない時。次のどれか
            - 予約がない、またはすでに取り消し済み(404)
            - 名前が空(400)
    """
    reservation = get_confirmed_reservation(db, reservation_id)
    customer_name = customer_name.strip()
    if not customer_name:
        raise AppError(400, "お名前を入力してください。")
    reservation.customer_name = customer_name
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: int) -> None:
    """予約を取り消し(論理削除)、コミットする

    DBからは消さず、statusをcancelledにする。取り消した時間は、また予約できるようになる。

    Args:
        db (Session): DBのセッション
        reservation_id (int): 予約ID

    Raises:
        AppError: 予約がない、またはすでに取り消し済みの時(404)
    """
    reservation = get_confirmed_reservation(db, reservation_id)
    reservation.status = reservations_crud.CANCELLED
    db.commit()
