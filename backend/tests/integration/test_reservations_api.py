"""/reservations、/admin/reservations、/historyの結合テスト"""
from datetime import timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src import config
from src.models import Reservation
from src.services import reservation_service
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


def test_contact_blank_only(client: TestClient, db: Session):
    # 空白だけのInstagramのIDや電話番号は、入力なしとして扱う
    response = reserve(client, "2026-10-12T01:00:00.000Z", instagram_id="  ", phone_number="　")

    assert response.status_code == 400
    assert db.query(Reservation).count() == 0


def test_contact_instagram_only(client: TestClient, db: Session):
    # InstagramのIDだけでも登録できる。前後の空白は取り除く
    response = reserve(client, "2026-10-12T01:00:00.000Z", instagram_id=" barber151 ")

    assert response.status_code == 200
    reservation = db.query(Reservation).one()
    assert reservation.instagram_id == "barber151"
    assert reservation.phone_number is None


def test_instagram_id_at_mark(client: TestClient, db: Session):
    # 先頭の@は取り除いて保存する
    response = reserve(client, "2026-10-12T01:00:00.000Z", instagram_id="@barber_151.jp")

    assert response.status_code == 200
    assert db.query(Reservation).one().instagram_id == "barber_151.jp"


@pytest.mark.parametrize("instagram_id", ["barber 151", "barber-151", "バーバー", "a" * 31])
def test_instagram_id_invalid(client: TestClient, db: Session, instagram_id: str):
    # 英数字・ピリオド・アンダースコアの30文字以内でないと登録できない
    response = reserve(client, "2026-10-12T01:00:00.000Z", instagram_id=instagram_id)

    assert response.status_code == 400
    assert response.json() == {"detail": "Instagram IDは英数字・ピリオド・アンダースコアの30文字以内で入力してください。"}
    assert db.query(Reservation).count() == 0


def test_invalid_menu(client: TestClient, db: Session):
    # ないメニューでは登録できない
    body = {"name": "山田", "phone_number": "09000000000", "menu_id": 999, "reservation_date": "2026-10-12T01:00:00.000Z"}
    response = client.post("/reservations", json=body)

    assert response.status_code == 400
    assert response.json() == {"detail": "無効なメニューです。"}
    assert db.query(Reservation).count() == 0


def test_deleted_menu(admin_client: TestClient, db: Session):
    # 削除したメニューでは登録できない
    admin_client.delete(f"/menus/{menu_id_of('カット')}")

    response = reserve(admin_client, "2026-10-12T01:00:00.000Z", menu_name="カット")

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


def test_get_reservation_slots(client: TestClient):
    # 確定済みの予約の時間帯を、UTCの日時(末尾Z)で返す。お客様の情報は返さない
    reserve(client, "2026-10-12T01:00:00.000Z", menu_name="フルコース")

    response = client.get("/reservations")

    assert response.status_code == 200
    assert response.json() == {
        "reservations": [
            {"start_datetime": "2026-10-12T01:00:00Z", "end_datetime": "2026-10-12T02:00:00Z"}
        ]
    }


def test_get_admin_reservations_instagram_id(admin_client: TestClient):
    # 管理用は、InstagramのIDも返す
    reserve(admin_client, "2026-10-12T01:00:00.000Z", instagram_id="barber151")

    response = admin_client.get("/admin/reservations")

    assert response.json()["reservations"][0]["instagram_id"] == "barber151"


def test_get_admin_reservations_phone_number(admin_client: TestClient):
    # 管理用は、電話番号も数字だけの形で返す
    reserve(admin_client, "2026-10-12T01:00:00.000Z", phone_number="090-1234-5678")

    response = admin_client.get("/admin/reservations")

    assert response.json()["reservations"][0]["phone_number"] == "09012345678"


def test_get_admin_reservations(admin_client: TestClient):
    # 管理用は、メニュー名とお客様の名前もつけて返す
    reserve(admin_client, "2026-10-12T01:00:00.000Z", menu_name="フルコース")

    response = admin_client.get("/admin/reservations")

    assert response.status_code == 200
    assert response.json() == {
        "reservations": [
            {
                "start_datetime": "2026-10-12T01:00:00Z",
                "end_datetime": "2026-10-12T02:00:00Z",
                "menu_name": "フルコース",
                "customer_name": "山田",
                "instagram_id": None,
                "phone_number": "09000000000",
            }
        ]
    }


def test_get_history(admin_client: TestClient):
    # 新しく作られた順に、最大10件返す
    for hour in range(11):
        reserve(admin_client, f"2026-10-12T{hour:02d}:00:00.000Z")

    response = admin_client.get("/history")

    assert response.status_code == 200
    history = response.json()["history"]
    assert len(history) == 10
    assert history[0]["start_datetime"] == "2026-10-12T10:00:00Z"
    assert history[0]["menu_name"] == "カット"
    assert history[0]["created_at"].endswith("Z")


def test_admin_reads_require_token(client: TestClient):
    # トークンがないと、お客様の情報は取れない
    reserve(client, "2026-10-12T01:00:00.000Z")

    for path in ["/admin/reservations", "/history"]:
        response = client.get(path)

        assert response.status_code == 401
        assert response.json() == {"detail": "管理用のトークンが正しくありません。"}


def test_admin_token_not_set(admin_client: TestClient, monkeypatch):
    # サーバーにトークンが設定されていなければ、どんなトークンでも拒否する
    monkeypatch.setattr(config, "ADMIN_TOKEN", "")

    assert admin_client.get("/history").status_code == 401


def test_seed_demo_reservations(db: Session):
    # 定休日(月・火)を除いた日に、重ならないダミーの予約を入れる。2回目は何もしない
    reservation_service.seed_demo_reservations(db)
    reservations = db.query(Reservation).order_by(Reservation.start_datetime).all()

    assert len(reservations) > 0
    for r in reservations:
        start_jst = r.start_datetime.replace(tzinfo=timezone.utc).astimezone(reservation_service.JST)
        end_jst = r.end_datetime.replace(tzinfo=timezone.utc).astimezone(reservation_service.JST)
        assert start_jst.weekday() not in (0, 1)
        assert 8 <= start_jst.hour and end_jst.hour <= 20
    for before, after in zip(reservations, reservations[1:]):
        assert before.end_datetime <= after.start_datetime

    reservation_service.seed_demo_reservations(db)
    assert db.query(Reservation).count() == len(reservations)


@pytest.mark.parametrize("phone_number", ["09012345678", "090-1234-5678", "090 1234 5678", "０９０－１２３４－５６７８"])
def test_phone_number_normalized(client: TestClient, db: Session, phone_number: str):
    # ハイフン・空白・全角数字は取り除いたり半角にしたりして、数字11桁で保存する
    response = reserve(client, "2026-10-12T01:00:00.000Z", phone_number=phone_number)

    assert response.status_code == 200
    assert db.query(Reservation).one().phone_number == "09012345678"


@pytest.mark.parametrize("phone_number", ["0901234567", "090123456789", "090-1234-567", "090abcd5678", "---"])
def test_phone_number_invalid(client: TestClient, db: Session, phone_number: str):
    # 電話番号が数字11桁でないと登録できない
    response = reserve(client, "2026-10-12T01:00:00.000Z", phone_number=phone_number)

    assert response.status_code == 400
    assert response.json() == {"detail": "電話番号は数字11桁で入力してください。"}
    assert db.query(Reservation).count() == 0
