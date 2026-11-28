"""テストで差し替えに使うもの(メモリ上のSQLiteにつなぐget_db、時刻を決められる時計)"""
from collections.abc import Iterator
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from src.time_utils import now_utc

# メモリ上のSQLiteは接続ごとに別のDBになるので、StaticPoolで1つの接続を使い回す
test_engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def get_test_db() -> Iterator[Session]:
    """テスト用のデータベースのセッションを作り、終わったら閉じる

    Yields:
        Session: テスト用のデータベースのセッション
    """
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


class FakeClock:
    """テストで時刻を決められる時計。ReservationServiceとDemoReservationsのnowに渡す

    fixedがNoneの間は本当の今の時刻を返す。作成日時の順番を確かめるテストが、そのまま動くようにするため。

    Attributes:
        fixed (datetime | None): 返す日時(UTC、タイムゾーンなし)。Noneなら本当の今の時刻
    """

    def __init__(self) -> None:
        self.fixed: datetime | None = None

    def __call__(self) -> datetime:
        return self.fixed if self.fixed is not None else now_utc()
