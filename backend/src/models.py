"""データベースのテーブル設計"""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from src.database import Base


class Menu(Base):
    """menus。メニューを1件1行で管理する

    削除は論理削除(is_activeをFalseにする)。過去の予約からメニュー名を引けるようにするため。

    Attributes:
        id (int): 主キー。自動採番
        category (str): 大きい項目。"cut"、"perm"、"color"のどれか
        name (str): メニュー名
        price (int): 料金(円)
        duration (int): 所要時間(時間)
        is_active (bool): 予約で選べるか。削除したらFalse
    """
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False)
    name = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)


class Reservation(Base):
    """reservations。1件の予約を1行で管理する

    日時はすべてタイムゾーンなしのUTCで保存する。

    Attributes:
        id (int): 主キー。自動採番
        customer_name (str): お客様の名前
        instagram_id (str | None): InstagramのID
        phone_number (str | None): 電話番号
        menu_id (int): menus.idの外部キー
        start_datetime (datetime): 開始日時(UTC)
        end_datetime (datetime): 終了日時(UTC)
        status (str): 予約の状態。"confirmed"など
        created_at (datetime): 予約を作った日時(UTC)
    """
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String, nullable=False)
    instagram_id = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="confirmed")
    created_at = Column(DateTime, nullable=False)

    menu = relationship("Menu")
