"""/menusの結合テスト"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.models import Menu
from src.services import menu_service
from src.services.menu_service import DEFAULT_MENUS

NEW_MENU = {"category": "perm", "name": "ツイストパーマ", "price": 10000, "duration": 3}


def test_get_menus(client: TestClient):
    # 初期データを登録した順に返す
    response = client.get("/menus")

    assert response.status_code == 200
    menus = response.json()["menus"]
    assert len(menus) == len(DEFAULT_MENUS)
    assert menus[0] == {"id": 1, "category": "cut", "name": "フルコース", "price": 6000, "duration": 1}


def test_create_menu(client: TestClient):
    # 追加したメニューが一覧の最後に出る
    response = client.post("/menus", json=NEW_MENU)

    assert response.status_code == 200
    created = response.json()
    assert created == {"id": len(DEFAULT_MENUS) + 1, **NEW_MENU}
    assert client.get("/menus").json()["menus"][-1] == created


def test_create_menu_strips_name(client: TestClient):
    # メニュー名の前後の空白は取り除く
    response = client.post("/menus", json={**NEW_MENU, "name": "  ツイスト  "})

    assert response.json()["name"] == "ツイスト"


def test_create_menu_invalid(client: TestClient, db: Session):
    # 大きい項目が固定のもの以外、名前が空、料金がマイナス、所要時間が0は登録できない
    for invalid in [{"category": "shave"}, {"name": "   "}, {"price": -1}, {"duration": 0}]:
        response = client.post("/menus", json={**NEW_MENU, **invalid})

        assert response.status_code == 422
    assert db.query(Menu).count() == len(DEFAULT_MENUS)


def test_update_menu(client: TestClient):
    # 料金や名前を書き換えられる
    response = client.put("/menus/1", json={"category": "cut", "name": "フルコース", "price": 6500, "duration": 1})

    assert response.status_code == 200
    assert response.json()["price"] == 6500
    assert client.get("/menus").json()["menus"][0]["price"] == 6500


def test_update_missing_menu(client: TestClient):
    # ないメニューは書き換えられない
    response = client.put("/menus/999", json=NEW_MENU)

    assert response.status_code == 404
    assert response.json() == {"detail": "メニューが見つかりません。"}


def test_delete_menu(client: TestClient, db: Session):
    # 削除すると一覧に出なくなるが、DBには残る
    response = client.delete("/menus/1")

    assert response.status_code == 204
    ids = [m["id"] for m in client.get("/menus").json()["menus"]]
    assert 1 not in ids
    assert db.get(Menu, 1).is_active is False


def test_delete_menu_twice(client: TestClient):
    # 削除済みのメニューは、もう一度削除も書き換えもできない
    client.delete("/menus/1")

    assert client.delete("/menus/1").status_code == 404
    assert client.put("/menus/1", json=NEW_MENU).status_code == 404


def test_seed_menus_keeps_edits(client: TestClient, db: Session):
    # 起動時のseed_menusは、すでにメニューがあれば上書きしない
    client.put("/menus/1", json={"category": "cut", "name": "フルコース", "price": 6500, "duration": 1})

    menu_service.seed_menus(db)

    assert db.query(Menu).count() == len(DEFAULT_MENUS)
    assert db.get(Menu, 1).price == 6500
