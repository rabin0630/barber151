"""予約のルール(連絡先の必須チェック、重複チェック)と、予約の登録・取得・変更の処理"""
from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from src.crud import menus_crud, reservations_crud
from src.exceptions import AppError
from src.models import Menu, Reservation
from src.services.cleaners import ExpiredReservationCleaner
from src.services.contacts import normalize_contacts
from src.time_utils import now_utc, to_utc_naive

HISTORY_LIMIT = 10


class ReservationService:
    """予約の登録・取得・変更・取り消し

    リクエストごとに、dependencies.pyのget_reservation_serviceで作る。

    Attributes:
        db (Session): DBのセッション
        cleaner (ExpiredReservationCleaner): 一覧や予約の前に呼ぶ、期限切れの予約の掃除
        now (Callable[[], datetime]): 今のUTCの日時(タイムゾーンなし)を返す関数。テストで時刻を決めるのに使う
    """

    def __init__(
        self,
        db: Session,
        cleaner: ExpiredReservationCleaner,
        now: Callable[[], datetime] = now_utc,
    ) -> None:
        self.db = db
        self.cleaner = cleaner
        self.now = now

    def list_confirmed(self) -> list[Reservation]:
        """確定済みの予約をすべて返す。期限切れの予約は先に消す

        Returns:
            list[Reservation]: 確定済みの予約
        """
        self.cleaner.delete_expired(self.db)
        return reservations_crud.get_confirmed_reservations(self.db)

    def list_history(self) -> list[Reservation]:
        """新しく作られた順に、予約をHISTORY_LIMIT件返す。期限切れの予約は先に消す

        Returns:
            list[Reservation]: 新しい順の予約
        """
        self.cleaner.delete_expired(self.db)
        return reservations_crud.get_latest_reservations(self.db, HISTORY_LIMIT)

    def get_confirmed(self, reservation_id: int) -> Reservation:
        """確定済みの予約を1件返す

        Args:
            reservation_id (int): 予約ID

        Returns:
            Reservation: 確定済みの予約

        Raises:
            AppError: 予約がない、またはすでに取り消し済みの時(404)
        """
        reservation = reservations_crud.get_reservation_by_id(self.db, reservation_id)
        if reservation is None or reservation.status != reservations_crud.CONFIRMED:
            raise AppError(404, "予約が見つかりません。")
        return reservation

    def create(
        self,
        customer_name: str,
        instagram_id: str | None,
        phone_number: str | None,
        menu_id: int,
        reservation_date: datetime,
    ) -> Reservation:
        """予約を登録する

        連絡先・メニュー・重複の順に確かめてから登録し、コミットする。

        Args:
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
        menu = self._get_bookable_menu(menu_id)

        start = to_utc_naive(reservation_date)
        end = start + timedelta(hours=menu.duration)

        # 期限切れの予約の枠は、また予約できるようにする
        self.cleaner.delete_expired(self.db)
        if self._has_overlap(start, end):
            raise AppError(400, "申し訳ありません。この時間はすでに予約が埋まっています。")

        reservation = reservations_crud.create_reservation(
            self.db, customer_name, instagram_id, phone_number, menu_id, start, end, self.now()
        )
        return self._save(reservation)

    def change_menu(self, reservation_id: int, menu_id: int) -> Reservation:
        """予約のメニューを変え、終了日時をメニューの所要時間に合わせて、コミットする

        開始日時はそのまま。長くなって次の予約と重なる時は変えない。

        Args:
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
        reservation = self.get_confirmed(reservation_id)
        menu = self._get_bookable_menu(menu_id)

        end = reservation.start_datetime + timedelta(hours=menu.duration)
        if self._has_overlap(reservation.start_datetime, end, exclude_id=reservation.id):
            raise AppError(409, "このあと予約している人がいるため延長できません。")

        reservation.menu_id = menu.id
        reservation.end_datetime = end
        return self._save(reservation)

    def change_contacts(
        self, reservation_id: int, instagram_id: str | None, phone_number: str | None
    ) -> Reservation:
        """予約のInstagramのIDと電話番号を書き換え、コミットする

        予約した時と同じルールで確かめる。どちらかは残っていないといけない。

        Args:
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
        reservation = self.get_confirmed(reservation_id)
        reservation.instagram_id, reservation.phone_number = normalize_contacts(instagram_id, phone_number)
        return self._save(reservation)

    def change_name(self, reservation_id: int, customer_name: str) -> Reservation:
        """予約のお客様の名前を書き換え、コミットする。前後の空白は取り除く

        Args:
            reservation_id (int): 予約ID
            customer_name (str): 新しい名前

        Returns:
            Reservation: 変更した予約

        Raises:
            AppError: 変更できない時。次のどれか
                - 予約がない、またはすでに取り消し済み(404)
                - 名前が空(400)
        """
        reservation = self.get_confirmed(reservation_id)
        customer_name = customer_name.strip()
        if not customer_name:
            raise AppError(400, "お名前を入力してください。")
        reservation.customer_name = customer_name
        return self._save(reservation)

    def cancel(self, reservation_id: int) -> None:
        """予約を取り消し(論理削除)、コミットする

        DBからは消さず、statusをcancelledにする。取り消した時間は、また予約できるようになる。

        Args:
            reservation_id (int): 予約ID

        Raises:
            AppError: 予約がない、またはすでに取り消し済みの時(404)
        """
        reservation = self.get_confirmed(reservation_id)
        reservation.status = reservations_crud.CANCELLED
        self.db.commit()

    def _get_bookable_menu(self, menu_id: int) -> Menu:
        """予約に使えるメニューを返す

        予約から見るとメニューIDは入力の一部なので、ない時は404ではなく400にする。

        Args:
            menu_id (int): メニューID

        Returns:
            Menu: 削除されていないメニュー

        Raises:
            AppError: メニューがない、または削除済みの時(400)
        """
        menu = menus_crud.get_menu_by_id(self.db, menu_id)
        if menu is None or not menu.is_active:
            raise AppError(400, "無効なメニューです。")
        return menu

    def _has_overlap(self, start: datetime, end: datetime, exclude_id: int | None = None) -> bool:
        """[start, end)と時間が重なる確定済みの予約があるか確かめる

        Args:
            start (datetime): 開始日時(UTC、タイムゾーンなし)
            end (datetime): 終了日時(UTC、タイムゾーンなし)
            exclude_id (int | None): 数えない予約のID。予約を変更する時に、その予約自身を除くのに使う

        Returns:
            bool: 重なる予約があればTrue
        """
        count = reservations_crud.count_overlapping_reservations(self.db, start, end, exclude_id=exclude_id)
        return count > 0

    def _save(self, reservation: Reservation) -> Reservation:
        """コミットして、DBの最新の状態を読み直す

        Args:
            reservation (Reservation): 保存する予約

        Returns:
            Reservation: 読み直した予約
        """
        self.db.commit()
        self.db.refresh(reservation)
        return reservation
