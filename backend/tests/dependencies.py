"""get_dbを、テスト用のデータベース(メモリ上のSQLite)につなぐものに差し替える"""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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
