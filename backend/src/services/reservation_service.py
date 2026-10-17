"""予約のルール(連絡先の必須チェック、重複チェック)と、予約の登録・取得の処理"""
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.exceptions import AppError
from src.models import Reservation

HISTORY_LIMIT = 10

## 日本時間。ダミーの予約を営業時間内に入れるのに使う
JST = timezone(timedelta(hours=9))

## ダミーの予約のお客様の名前。DEMO_DATAがtrueの時だけ使う
DEMO_CUSTOMERS: list[str] = ["デモ 太郎", "サンプル 花子", "テスト 一郎", "見本 次郎", "仮名 三郎"]

## ダミーの予約を入れる時刻(日本時間)。所要時間が最大3時間でも重ならず、20時までに終わる
DEMO_HOURS: list[int] = [10, 15]

## ダミーの予約を入れる日数(明日から)
DEMO_DAYS = 14

## InstagramのIDの形式。英数字・ピリオド・アンダースコアで30文字以内
INSTAGRAM_ID_PATTERN = re.compile(r"[A-Za-z0-9._]{1,30}")


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



def normalize_instagram_id(instagram_id: str | None) -> str | None:
    """InstagramのIDから前後の空白と先頭の@を取り除き、形式を確かめる

    Args:
        instagram_id (str | None): 入力されたInstagramのID

    Returns:
        str | None: 取り除いた後のID。空ならNone

    Raises:
        AppError: 形式が正しくない時(400)
    """
    instagram_id = (instagram_id or "").strip().removeprefix("@")
    if not instagram_id:
        return None
    if not INSTAGRAM_ID_PATTERN.fullmatch(instagram_id):
        raise AppError(400, "Instagram IDは英数字・ピリオド・アンダースコアの30文字以内で入力してください。")
    return instagram_id


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
            - InstagramのIDか電話番号の形式が正しくない
            - メニューIDがない、または削除済み
            - 他の予約と時間が重なる
    """
    # 空白だけの入力は、入力なしとして扱う
    instagram_id = normalize_instagram_id(instagram_id)
    phone_number = (phone_number or "").strip() or None
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


def seed_demo_reservations(db: Session) -> None:
    """予約が1件もなければ、明日からDEMO_DAYS日分のダミーの予約を登録し、コミットする

    定休日(月・火)を除いた日に、DEMO_HOURSの時刻で入れる。メニューは順番に使う。

    Args:
        db (Session): DBのセッション
    """
    if reservations_crud.count_reservations(db) > 0:
        return
    menus = menus_crud.get_active_menus(db)
    if not menus:
        return

    today = datetime.now(JST).date()
    count = 0
    for offset in range(1, DEMO_DAYS + 1):
        day = today + timedelta(days=offset)
        if day.weekday() in (0, 1):  # 月・火は定休日
            continue
        for hour in DEMO_HOURS:
            menu = menus[count % len(menus)]
            start = to_utc_naive(datetime(day.year, day.month, day.day, hour, tzinfo=JST))
            reservations_crud.create_reservation(
                db,
                DEMO_CUSTOMERS[count % len(DEMO_CUSTOMERS)],
                None,
                "090-0000-0000",
                menu.id,
                start,
                start + timedelta(hours=menu.duration),
                now_utc() - timedelta(hours=count),
            )
            count += 1
    db.commit()
