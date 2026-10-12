"""テストで共通に使うもの(fixture)"""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.database import Base
from src.dependencies import get_db
from src.main import app
from src.services import menu_service
from tests.dependencies import TestSessionLocal, get_test_db, test_engine


@pytest.fixture(autouse=True)
def reset_tables() -> Iterator[None]:
    """各テストの前に、テーブルを作り直してメニューを登録する"""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    with TestSessionLocal() as db:
        menu_service.seed_menus(db)
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    """get_dbをテスト用のデータベースに差し替えたTestClient

    withを使わないので、lifespan(本番のデータベースへのcreate_all)は動かない。

    Yields:
        TestClient: APIを呼ぶクライアント
    """
    app.dependency_overrides[get_db] = get_test_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def db() -> Iterator[Session]:
    """テスト用のデータベースの中身を確かめるためのセッション

    Yields:
        Session: テスト用のデータベースのセッション
    """
    with TestSessionLocal() as session:
        yield session
