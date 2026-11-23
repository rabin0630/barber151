"""テストで共通に使うもの(fixture)"""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src import config
from src.database import Base
from src.dependencies import get_cleaner, get_db
from src.main import app
from src.services import menu_service
from src.services.cleaners import DemoReservations
from tests.dependencies import TestSessionLocal, get_test_db, test_engine


## テストで使う管理用のトークン
ADMIN_TOKEN = "test-admin-token"


@pytest.fixture(autouse=True)
def admin_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """各テストで、管理用のトークンをADMIN_TOKENにする"""
    monkeypatch.setattr(config, "ADMIN_TOKEN", ADMIN_TOKEN)


@pytest.fixture(autouse=True)
def reset_tables() -> Iterator[None]:
    """各テストの前に、テーブルを作り直してメニューを登録する"""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    with TestSessionLocal() as db:
        menu_service.seed_menus(db)
    yield


@pytest.fixture
def demo() -> DemoReservations:
    """テストごとに新しく作る、デモの予約の掃除

    seedを呼ぶまではseeded_atがNoneで何も消さないので、seedを呼んだテストだけ掃除が動く。

    Returns:
        DemoReservations: デモの予約の掃除
    """
    return DemoReservations()


@pytest.fixture
def client(demo: DemoReservations) -> Iterator[TestClient]:
    """get_dbをテスト用のデータベースに、get_cleanerをdemoに差し替えたTestClient

    withを使わないので、lifespan(本番のデータベースへのcreate_allと、app.state.cleanerを置く処理)は動かない。

    Args:
        demo (DemoReservations): デモの予約の掃除

    Yields:
        TestClient: APIを呼ぶクライアント
    """
    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_cleaner] = lambda: demo
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(client: TestClient) -> TestClient:
    """管理用のトークンをAuthorizationヘッダーにつけたTestClient

    Args:
        client (TestClient): get_dbを差し替えたTestClient

    Returns:
        TestClient: 管理用APIを呼べるクライアント
    """
    client.headers["Authorization"] = f"Bearer {ADMIN_TOKEN}"
    return client


@pytest.fixture
def db() -> Iterator[Session]:
    """テスト用のデータベースの中身を確かめるためのセッション

    Yields:
        Session: テスト用のデータベースのセッション
    """
    with TestSessionLocal() as session:
        yield session
