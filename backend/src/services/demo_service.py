"""ポートフォリオのデモ用の、ダミーの予約の入れ直し"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.time_utils import now_utc, to_utc_naive

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
DEMO_DAYS = 365


def seed_demo_reservations(db: Session) -> None:
    """予約をすべて消し、明日からDEMO_DAYS日分のダミーの予約を入れ直して、コミットする

    起動するたびに呼び、名前や日付をいつも新しくする。
    定休日(月・火)を除いた日に、DEMO_HOURSの時刻で入れる。メニューとお客様は順番に使う。

    Args:
        db (Session): DBのセッション
    """
    reservations_crud.delete_all_reservations(db)
    menus = menus_crud.get_active_menus(db)

    now = now_utc()
    today = now.replace(tzinfo=timezone.utc).astimezone(JST).date()
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
                now - timedelta(hours=count),
            )
            count += 1
    db.commit()
