"""テストで共通に使うもの(fixture)"""
from collections.abc import Iterator

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src import config
from src.database import Base
from src.dependencies import get_db, get_reservation_service
from src.main import app
from src.services import menu_service
from src.services.cleaners import DemoReservations
from src.services.reservation_service import ReservationService
from tests.dependencies import FakeClock, TestSessionLocal, get_test_db, test_engine


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
def clock() -> FakeClock:
    """テストごとに新しく作る、時刻を決められる時計

    Returns:
        FakeClock: 時計。clock.fixedに日時を入れると、その時刻になる
    """
    return FakeClock()


@pytest.fixture
def demo(clock: FakeClock) -> DemoReservations:
    """テストごとに新しく作る、デモの予約の掃除

    seedを呼ぶまではseeded_atがNoneで何も消さないので、seedを呼んだテストだけ掃除が動く。

    Args:
        clock (FakeClock): 時計

    Returns:
        DemoReservations: デモの予約の掃除
    """
    return DemoReservations(now=clock)


@pytest.fixture
def client(demo: DemoReservations, clock: FakeClock) -> Iterator[TestClient]:
    """get_dbをテスト用のデータベースに、ReservationServiceをdemoとclockを使うものに差し替えたTestClient

    withを使わないので、lifespan(本番のデータベースへのcreate_allと、app.state.cleanerを置く処理)は動かない。

    Args:
        demo (DemoReservations): デモの予約の掃除
        clock (FakeClock): 時計

    Yields:
        TestClient: APIを呼ぶクライアント
    """

    def get_test_reservation_service(db: Session = Depends(get_db)) -> ReservationService:
        return ReservationService(db, demo, now=clock)

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_reservation_service] = get_test_reservation_service
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
