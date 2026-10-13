"""DBの接続(エンジンとセッション)と、テーブル定義の土台(Base)を作る"""
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from src import config


def make_connect_args(database_url: str) -> dict[str, Any]:
    """エンジンに渡すconnect_argsを作る

    SQLiteはFastAPIのスレッドをまたいで使うため、check_same_threadを切る。

    Args:
        database_url (str): DBの接続先のURL

    Returns:
        dict[str, Any]: create_engineのconnect_args
    """
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine = create_engine(config.DATABASE_URL, connect_args=make_connect_args(config.DATABASE_URL), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
