"""/reservations、/historyの結合テスト"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.models import Reservation
from src.services.menu_service import DEFAULT_MENUS


def menu_id_of(name: str) -> int:
    """初期データのメニュー名からメニューIDを返す。DEFAULT_MENUSの順に1から採番される

    Args:
        name (str): メニュー名

    Returns:
        int: メニューID
    """
    names = [menu[1] for menu in DEFAULT_MENUS]
    return names.index(name) + 1


def reserve(client: TestClient, reservation_date: str, menu_name: str = "カット", **contact: str):
    """POST /reservationsを呼ぶ

    Args:
        client (TestClient): APIを呼ぶクライアント
        reservation_date (str): 開始日時(ISO8601)
        menu_name (str): 初期データのメニュー名
        **contact (str): instagram_id、phone_number。省略するとphone_numberだけ入れる

    Returns:
        httpx.Response: APIのレスポンス
    """
    body = {"name": "山田", "menu_id": menu_id_of(menu_name), "reservation_date": reservation_date}
    body.update(contact or {"phone_number": "09000000000"})
    return client.post("/reservations", json=body)


def test_create_reservation(client: TestClient, db: Session):
    # メニューの所要時間から終了時刻を決めて登録できる
    response = reserve(client, "2026-10-12T01:00:00.000Z", menu_name="パンチパーマ")

    assert response.status_code == 200
    assert response.json() == {"message": "予約が完了しました！"}
    reservation = db.query(Reservation).one()
    assert reservation.start_datetime.isoformat() == "2026-10-12T01:00:00"
    assert reservation.end_datetime.isoformat() == "2026-10-12T04:00:00"


def test_contact_required(client: TestClient, db: Session):
    # InstagramのIDも電話番号もないと登録できない
    response = reserve(client, "2026-10-12T01:00:00.000Z", instagram_id="", phone_number="")

    assert response.status_code == 400
    assert response.json() == {"detail": "Instagram ID または 電話番号のどちらかを入力してください。"}
    assert db.query(Reservation).count() == 0


def test_invalid_menu(client: TestClient, db: Session):
    # ないメニューでは登録できない
    body = {"name": "山田", "phone_number": "09000000000", "menu_id": 999, "reservation_date": "2026-10-12T01:00:00.000Z"}
    response = client.post("/reservations", json=body)

    assert response.status_code == 400
    assert response.json() == {"detail": "無効なメニューです。"}
    assert db.query(Reservation).count() == 0


def test_deleted_menu(client: TestClient, db: Session):
    # 削除したメニューでは登録できない
    client.delete(f"/menus/{menu_id_of('カット')}")

    response = reserve(client, "2026-10-12T01:00:00.000Z", menu_name="カット")

    assert response.status_code == 400
    assert response.json() == {"detail": "無効なメニューです。"}
    assert db.query(Reservation).count() == 0


def test_overlapping_reservation(client: TestClient, db: Session):
    # 時間が重なる予約は登録できないが、ちょうど終わった時刻からは登録できる
    reserve(client, "2026-10-12T01:00:00.000Z", menu_name="カラー")

    overlapped = reserve(client, "2026-10-12T02:00:00.000Z")
    adjacent = reserve(client, "2026-10-12T03:00:00.000Z")

    assert overlapped.status_code == 400
    assert overlapped.json() == {"detail": "申し訳ありません。この時間はすでに予約が埋まっています。"}
    assert adjacent.status_code == 200
    assert db.query(Reservation).count() == 2


def test_overlap_with_other_timezone(client: TestClient):
    # 日本時間で送られても、UTCに直して重なりを確かめる
    reserve(client, "2026-10-12T01:00:00.000Z")

    response = reserve(client, "2026-10-12T10:30:00+09:00")

    assert response.status_code == 400


def test_get_reservations(client: TestClient):
    # 確定済みの予約を、UTCの日時(末尾Z)とメニュー名つきで返す
    reserve(client, "2026-10-12T01:00:00.000Z", menu_name="フルコース")

    response = client.get("/reservations")

    assert response.status_code == 200
    assert response.json() == {
        "reservations": [
            {
                "start_datetime": "2026-10-12T01:00:00Z",
                "end_datetime": "2026-10-12T02:00:00Z",
                "menu_name": "フルコース",
                "customer_name": "山田",
            }
        ]
    }


def test_get_history(client: TestClient):
    # 新しく作られた順に、最大10件返す
    for hour in range(11):
        reserve(client, f"2026-10-12T{hour:02d}:00:00.000Z")

    response = client.get("/history")

    assert response.status_code == 200
    history = response.json()["history"]
    assert len(history) == 10
    assert history[0]["start_datetime"] == "2026-10-12T10:00:00Z"
    assert history[0]["menu_name"] == "カット"
    assert history[0]["created_at"].endswith("Z")
