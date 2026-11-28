"""一覧や予約の前に呼ぶ、期限切れの予約の掃除(本番用は何もしない、デモ用はダミーの予約の入れ直しも持つ)"""
from abc import ABC, abstractmethod
from collections.abc import Callable
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
DEMO_DAYS = 14

## デモ中に作られた予約を消すまでの時間。見に来た人が試した予約がたまらないようにする
DEMO_RESERVATION_LIFETIME = timedelta(minutes=5)


class ExpiredReservationCleaner(ABC):
    """一覧や予約の前に呼ぶ、期限切れの予約の掃除

    予約の処理は、デモかどうかを知らずにdelete_expiredを呼ぶだけにする。
    どの掃除を使うかは、main.pyのlifespanで1回だけ決める。
    """

    @abstractmethod
    def delete_expired(self, db: Session) -> None:
        """期限切れの予約を消す

        Args:
            db (Session): DBのセッション
        """


class NoCleanup(ExpiredReservationCleaner):
    """本番用。何も消さない"""

    def delete_expired(self, db: Session) -> None:
        """何もしない

        Args:
            db (Session): DBのセッション
        """


class DemoReservations(ExpiredReservationCleaner):
    """デモ用。ダミーの予約を入れ直し、デモ中に作られた予約を時間が過ぎたら消す

    seeded_atはリクエストをまたいで覚えておく必要があるので、アプリで1つだけ作って使い回す。

    Attributes:
        seeded_at (datetime | None): ダミーの予約を入れ直した日時(UTC)。
            これより後に作られた予約を、DEMO_RESERVATION_LIFETIMEで消す。入れ直す前はNoneで、何も消さない
        now (Callable[[], datetime]): 今のUTCの日時(タイムゾーンなし)を返す関数。テストで時刻を決めるのに使う
    """

    def __init__(self, now: Callable[[], datetime] = now_utc) -> None:
        self.seeded_at: datetime | None = None
        self.now = now

    def seed(self, db: Session) -> None:
        """予約をすべて消し、明日からDEMO_DAYS日分のダミーの予約を入れ直して、コミットする

        起動するたびに呼び、名前や日付をいつも新しくする。
        定休日(月・火)を除いた日に、DEMO_HOURSの時刻で入れる。メニューとお客様は順番に使う。
        入れ直した日時をseeded_atに置き、これより後に作られた予約を時間が過ぎたら消すようにする。

        Args:
            db (Session): DBのセッション
        """
        reservations_crud.delete_all_reservations(db)
        menus = menus_crud.get_active_menus(db)

        today = self.now().replace(tzinfo=timezone.utc).astimezone(JST).date()
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
                    self.now() - timedelta(hours=count),
                )
                count += 1
        db.commit()
        self.seeded_at = self.now()

    def delete_expired(self, db: Session) -> None:
        """デモ中に作られ、DEMO_RESERVATION_LIFETIMEを過ぎた予約を消し、コミットする

        予約画面・管理画面のどちらから作った予約も消す。ダミーの予約は消さない。
        まだ入れ直していない時(seeded_atがNone)は何もしない。

        Args:
            db (Session): DBのセッション
        """
        if self.seeded_at is None:
            return
        reservations_crud.delete_reservations_created_between(
            db, self.seeded_at, self.now() - DEMO_RESERVATION_LIFETIME
        )
        db.commit()
