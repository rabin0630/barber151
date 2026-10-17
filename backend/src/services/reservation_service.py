"""予約のルール(連絡先の必須チェック、重複チェック)と、予約の登録・取得の処理"""
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.exceptions import AppError
from src.models import Reservation

HISTORY_LIMIT = 10

## 電話番号の形式。区切りを取り除いた後の数字11桁
PHONE_NUMBER_PATTERN = re.compile(r"[0-9]{11}")

## 電話番号から取り除く区切り(空白・いろいろなハイフン・長音)
PHONE_NUMBER_SEPARATORS = re.compile(r"[\s\-‐‑–—−ー－]")

## 全角数字を半角数字にする変換表
FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")

## 日本時間。ダミーの予約を営業時間内に入れるのに使う
JST = timezone(timedelta(hours=9))

## ダミーの予約のお客様の(名前, InstagramのID)。DEMO_DATAがtrueの時だけ使う
## 著名人とサッカー選手の公式アカウント。電話番号はすべてDEMO_PHONE_NUMBERにする
DEMO_CUSTOMERS: list[tuple[str, str]] = [
    ("ジャスティン・ビーバー", "justinbieber"),
    ("アリアナ・グランデ", "arianagrande"),
    ("ティム・クック", "tim_cook"),
    ("テイラー・スウィフト", "taylorswift"),
    ("ドウェイン・ジョンソン", "therock"),
    ("セレーナ・ゴメス", "selenagomez"),
    ("クリスティアーノ・ロナウド", "cristiano"),
    ("リオネル・メッシ", "leomessi"),
    ("ネイマール", "neymarjr"),
]

## ダミーの予約の電話番号
DEMO_PHONE_NUMBER = "090-0000-0000"

## ダミーの予約を入れる時刻(日本時間)。所要時間が最大3時間でも重ならず、20時までに終わる
DEMO_HOURS: list[int] = [10, 15]

## ダミーの予約を入れる日数(明日から)
DEMO_DAYS = 14

## デモ中に作られた予約を消すまでの時間。見に来た人が試した予約がたまらないようにする
DEMO_RESERVATION_LIFETIME = timedelta(minutes=5)

## ダミーの予約を入れ直した日時(UTC)。これより後に作られた予約は、DEMO_RESERVATION_LIFETIMEで消す
## デモでない時はNoneのままで、何も消さない
demo_seeded_at: datetime | None = None

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


def delete_expired_demo_reservations(db: Session) -> None:
    """デモ中に作られ、DEMO_RESERVATION_LIFETIMEを過ぎた予約を消し、コミットする

    予約画面・管理画面のどちらから作った予約も消す。ダミーの予約は消さない。
    デモでない時(demo_seeded_atがNone)は何もしない。

    Args:
        db (Session): DBのセッション
    """
    if demo_seeded_at is None:
        return
    reservations_crud.delete_reservations_created_between(
        db, demo_seeded_at, now_utc() - DEMO_RESERVATION_LIFETIME
    )
    db.commit()


def list_confirmed_reservations(db: Session) -> list[Reservation]:
    """確定済みの予約をすべて返す。デモ中は、時間が過ぎた予約を先に消す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Reservation]: 確定済みの予約
    """
    delete_expired_demo_reservations(db)
    return reservations_crud.get_confirmed_reservations(db)


def list_history(db: Session) -> list[Reservation]:
    """新しく作られた順に、予約をHISTORY_LIMIT件返す。デモ中は、時間が過ぎた予約を先に消す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Reservation]: 新しい順の予約
    """
    delete_expired_demo_reservations(db)
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


def normalize_contacts(instagram_id: str | None, phone_number: str | None) -> tuple[str | None, str | None]:
    """InstagramのIDと電話番号を保存する形に整え、どちらかがあるか確かめる

    電話番号は090-1234-5678や全角数字も受け付け、数字だけにする。空白だけの入力は入力なしとして扱う。

    Args:
        instagram_id (str | None): 入力されたInstagramのID
        phone_number (str | None): 入力された電話番号

    Returns:
        tuple[str | None, str | None]: 整えた後の(InstagramのID, 電話番号)

    Raises:
        AppError: 次のどれかの時(400)
            - InstagramのIDも電話番号もない
            - InstagramのIDか電話番号の形式が正しくない
    """
    instagram_id = normalize_instagram_id(instagram_id)
    phone_number = (phone_number or "").strip() or None
    if not instagram_id and not phone_number:
        raise AppError(400, "Instagram ID または 電話番号のどちらかを入力してください。")
    if phone_number:
        phone_number = PHONE_NUMBER_SEPARATORS.sub("", phone_number.translate(FULLWIDTH_DIGITS))
        if not PHONE_NUMBER_PATTERN.fullmatch(phone_number):
            raise AppError(400, "電話番号は数字11桁で入力してください。")
    return instagram_id, phone_number


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
    instagram_id, phone_number = normalize_contacts(instagram_id, phone_number)

    menu = menus_crud.get_menu_by_id(db, menu_id)
    if menu is None or not menu.is_active:
        raise AppError(400, "無効なメニューです。")

    start = to_utc_naive(reservation_date)
    end = start + timedelta(hours=menu.duration)

    # デモ中に時間が過ぎた予約の枠は、また予約できるようにする
    delete_expired_demo_reservations(db)
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


def seed_demo_reservations(db: Session) -> None:
    """予約をすべて消し、明日からDEMO_DAYS日分のダミーの予約を入れ直して、コミットする

    デモ用。起動するたびに呼び、名前や日付をいつも新しくする。
    定休日(月・火)を除いた日に、DEMO_HOURSの時刻で入れる。メニューとお客様は順番に使う。
    入れ直した日時をdemo_seeded_atに置き、これより後に作られた予約を時間が過ぎたら消すようにする。

    Args:
        db (Session): DBのセッション
    """
    global demo_seeded_at
    reservations_crud.delete_all_reservations(db)
    menus = menus_crud.get_active_menus(db)

    today = datetime.now(JST).date()
    count = 0
    for offset in range(1, DEMO_DAYS + 1):
        day = today + timedelta(days=offset)
        if day.weekday() in (0, 1):  # 月・火は定休日
            continue
        for hour in DEMO_HOURS:
            menu = menus[count % len(menus)]
            start = to_utc_naive(datetime(day.year, day.month, day.day, hour, tzinfo=JST))
            customer_name, instagram_id = DEMO_CUSTOMERS[count % len(DEMO_CUSTOMERS)]
            reservations_crud.create_reservation(
                db,
                customer_name,
                instagram_id,
                DEMO_PHONE_NUMBER,
                menu.id,
                start,
                start + timedelta(hours=menu.duration),
                now_utc() - timedelta(hours=count),
            )
            count += 1
    db.commit()
    demo_seeded_at = now_utc()
