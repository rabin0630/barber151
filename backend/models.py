from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, ForeignKey, Integer, String, DateTime

Base = declarative_base()

# テーブルの設計
## カラムを追加する時のための拡張性の向上のため


class Menus(Base):
    __tablename__ = "menus"  

    menus_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)


class Reservations(Base):
    __tablename__ = "reservations"

    reservation_id = Column(
        Integer, primary_key=True, autoincrement=True
    )  # ランダムな数字を格納するので、autoincrementを使用
    customer_name = Column(String, nullable=False)
    instagram_id = Column(String)
    phone_number = Column(String)
    menu_id = Column(String, nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    status = Column(String, default="confirmed")
    created_at = Column(DateTime, default="現在の時間")
