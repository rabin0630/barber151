"""FastAPIのDependsで使う共通の部品(DBのセッション)"""
from collections.abc import Iterator

from sqlalchemy.orm import Session

from src.database import SessionLocal


def get_db() -> Iterator[Session]:
    """リクエストごとにDBのセッションを作り、終わったら閉じる

    Yields:
        Session: DBのセッション
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
