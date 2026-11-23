"""FastAPIのDependsで使う共通の部品(DBのセッション、期限切れの予約の掃除、管理用APIの認証)"""
import secrets
from collections.abc import Iterator

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src import config
from src.database import SessionLocal
from src.exceptions import AppError
from src.services.cleaners import ExpiredReservationCleaner

## auto_error=Falseにして、ヘッダーがない時もrequire_adminで同じ401を返す
bearer_scheme = HTTPBearer(auto_error=False)


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


def get_cleaner(request: Request) -> ExpiredReservationCleaner:
    """main.pyのlifespanで1つだけ作った、期限切れの予約の掃除を返す

    Args:
        request (Request): 受け取ったリクエスト

    Returns:
        ExpiredReservationCleaner: デモならDemoReservations、そうでなければNoCleanup
    """
    return request.app.state.cleaner


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> None:
    """Authorization: Bearer <トークン>が、config.ADMIN_TOKENと同じか確かめる

    ADMIN_TOKENが空の時は、設定し忘れでも公開されないよう、すべて拒否する。

    Args:
        credentials (HTTPAuthorizationCredentials | None): Authorizationヘッダーの中身

    Raises:
        AppError: トークンがない、または違う時(401)
    """
    if (
        not config.ADMIN_TOKEN
        or credentials is None
        or not secrets.compare_digest(credentials.credentials.encode(), config.ADMIN_TOKEN.encode())
    ):
        raise AppError(401, "管理用のトークンが正しくありません。")
