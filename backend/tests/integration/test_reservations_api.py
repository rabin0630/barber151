"""/reservations、/admin/reservations、/historyの結合テスト"""
from datetime import datetime, timedelta, timezone

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
                "id": 1,
                "start_datetime": "2026-10-12T01:00:00Z",
                "end_datetime": "2026-10-12T02:00:00Z",
                "menu_id": menu_id_of("フルコース"),
                "menu_name": "フルコース",
                "customer_name": "山田",
                "instagram_id": None,
                "phone_number": "09000000000",
            }
        ]
    }


def test_cancel_reservation(admin_client: TestClient, db: Session):
    # 取り消すと一覧に出なくなり、同じ時間にまた予約できる。DBには残る
    reserve(admin_client, "2026-10-12T01:00:00.000Z")

    response = admin_client.delete("/admin/reservations/1")

    assert response.status_code == 204
    assert admin_client.get("/admin/reservations").json() == {"reservations": []}
    assert admin_client.get("/reservations").json() == {"reservations": []}
    assert db.get(Reservation, 1).status == "cancelled"
    assert reserve(admin_client, "2026-10-12T01:00:00.000Z").status_code == 200


def test_cancel_reservation_not_found(admin_client: TestClient):
    # ない予約や、取り消し済みの予約は取り消せない
    reserve(admin_client, "2026-10-12T01:00:00.000Z")
    admin_client.delete("/admin/reservations/1")

    for reservation_id in [1, 999]:
        response = admin_client.delete(f"/admin/reservations/{reservation_id}")

        assert response.status_code == 404
        assert response.json() == {"detail": "予約が見つかりません。"}


def test_cancel_reservation_requires_token(client: TestClient, db: Session):
    # トークンがないと取り消せない
    reserve(client, "2026-10-12T01:00:00.000Z")

    response = client.delete("/admin/reservations/1")

    assert response.status_code == 401
    assert db.get(Reservation, 1).status == "confirmed"


def test_change_reservation_menu(admin_client: TestClient, db: Session):
    # メニューを変えると、所要時間に合わせて終了時刻も変わる
    reserve(admin_client, "2026-10-12T01:00:00.000Z", menu_name="カット")

    response = admin_client.patch("/admin/reservations/1", json={"menu_id": menu_id_of("パンチパーマ")})

    assert response.status_code == 200
    assert response.json()["menu_name"] == "パンチパーマ"
    assert response.json()["end_datetime"] == "2026-10-12T04:00:00Z"
    reservation = db.get(Reservation, 1)
    assert reservation.menu_id == menu_id_of("パンチパーマ")
    assert reservation.end_datetime.isoformat() == "2026-10-12T04:00:00"


def test_change_reservation_menu_overlap(admin_client: TestClient, db: Session):
    # 長くして次の予約と重なる時は変えない。ちょうど次の予約の前までなら変えられる
    reserve(admin_client, "2026-10-12T01:00:00.000Z", menu_name="カット")
    reserve(admin_client, "2026-10-12T03:00:00.000Z", menu_name="カット")

    overlapped = admin_client.patch("/admin/reservations/1", json={"menu_id": menu_id_of("パンチパーマ")})
    adjacent = admin_client.patch("/admin/reservations/1", json={"menu_id": menu_id_of("カラー")})

    assert overlapped.status_code == 409
    assert overlapped.json() == {"detail": "このあと予約している人がいるため延長できません。"}
    assert adjacent.status_code == 200
    assert db.get(Reservation, 1).end_datetime.isoformat() == "2026-10-12T03:00:00"


def test_change_reservation_menu_shorter(admin_client: TestClient):
    # 短くするのは、自分自身と重なっていても変えられる
    reserve(admin_client, "2026-10-12T01:00:00.000Z", menu_name="パンチパーマ")

    response = admin_client.patch("/admin/reservations/1", json={"menu_id": menu_id_of("カット")})

    assert response.status_code == 200
    assert response.json()["end_datetime"] == "2026-10-12T02:00:00Z"


def test_change_reservation_menu_invalid(admin_client: TestClient):
    # ない予約や、ないメニューには変えられない
    reserve(admin_client, "2026-10-12T01:00:00.000Z")

    assert admin_client.patch("/admin/reservations/999", json={"menu_id": 1}).status_code == 404
    assert admin_client.patch("/admin/reservations/1", json={"menu_id": 999}).status_code == 400


def test_change_reservation_menu_requires_token(client: TestClient):
    # トークンがないと変えられない
    reserve(client, "2026-10-12T01:00:00.000Z")

    assert client.patch("/admin/reservations/1", json={"menu_id": 1}).status_code == 401


def test_change_reservation_contacts(admin_client: TestClient, db: Session):
    # 連絡先は予約した時と同じ形に整えて保存する
    reserve(admin_client, "2026-10-12T01:00:00.000Z", phone_number="09000000000")

    response = admin_client.patch(
        "/admin/reservations/1/contacts", json={"instagram_id": "@new_id", "phone_number": "080-1111-2222"}
    )

    assert response.status_code == 200
    assert response.json()["instagram_id"] == "new_id"
    assert response.json()["phone_number"] == "08011112222"
    reservation = db.get(Reservation, 1)
    assert (reservation.instagram_id, reservation.phone_number) == ("new_id", "08011112222")


def test_change_reservation_contacts_clear_one(admin_client: TestClient, db: Session):
    # どちらかが残っていれば、もう片方は消せる
    reserve(admin_client, "2026-10-12T01:00:00.000Z", instagram_id="barber", phone_number="09000000000")

    response = admin_client.patch(
        "/admin/reservations/1/contacts", json={"instagram_id": "barber", "phone_number": ""}
    )

    assert response.status_code == 200
    assert db.get(Reservation, 1).phone_number is None


@pytest.mark.parametrize(
    "contacts, detail",
    [
        ({"instagram_id": "", "phone_number": " "}, "Instagram ID または 電話番号のどちらかを入力してください。"),
        ({"instagram_id": None, "phone_number": "090-1234-567"}, "電話番号は数字11桁で入力してください。"),
        (
            {"instagram_id": "バーバー", "phone_number": "09000000000"},
            "Instagram IDは英数字・ピリオド・アンダースコアの30文字以内で入力してください。",
        ),
    ],
)
def test_change_reservation_contacts_invalid(admin_client: TestClient, db: Session, contacts, detail):
    # 予約した時と同じルールに合わない時は変えない
    reserve(admin_client, "2026-10-12T01:00:00.000Z", phone_number="09000000000")

    response = admin_client.patch("/admin/reservations/1/contacts", json=contacts)

    assert response.status_code == 400
    assert response.json() == {"detail": detail}
    assert db.get(Reservation, 1).phone_number == "09000000000"


def test_change_reservation_contacts_errors(client: TestClient, admin_client: TestClient):
    # ない予約は404、トークンがないと401
    reserve(client, "2026-10-12T01:00:00.000Z")
    body = {"phone_number": "09000000000"}

    assert admin_client.patch("/admin/reservations/999/contacts", json=body).status_code == 404
    client.headers.pop("Authorization")
    assert client.patch("/admin/reservations/1/contacts", json=body).status_code == 401


def test_change_reservation_name(admin_client: TestClient, db: Session):
    # 名前を書き換える。前後の空白は取り除く
    reserve(admin_client, "2026-10-12T01:00:00.000Z")

    response = admin_client.patch("/admin/reservations/1/name", json={"customer_name": " 山田 花子　"})

    assert response.status_code == 200
    assert response.json()["customer_name"] == "山田 花子"
    assert db.get(Reservation, 1).customer_name == "山田 花子"


def test_change_reservation_name_errors(client: TestClient, admin_client: TestClient, db: Session):
    # 空の名前は400、ない予約は404、トークンがないと401。どれも変えない
    reserve(client, "2026-10-12T01:00:00.000Z")

    blank = admin_client.patch("/admin/reservations/1/name", json={"customer_name": "　"})

    assert blank.status_code == 400
    assert blank.json() == {"detail": "お名前を入力してください。"}
    assert admin_client.patch("/admin/reservations/999/name", json={"customer_name": "a"}).status_code == 404
    client.headers.pop("Authorization")
    assert client.patch("/admin/reservations/1/name", json={"customer_name": "a"}).status_code == 401
    assert db.get(Reservation, 1).customer_name == "山田"


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
    # 定休日(月・火)を除いた日に、重ならないダミーの予約を入れる。2回目は入れ直すので、件数は変わらない
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
    # お客様の名前とInstagramのIDは、DEMO_CUSTOMERSから順に使う
    assert (reservations[0].customer_name, reservations[0].instagram_id) == reservation_service.DEMO_CUSTOMERS[0]
    for name, instagram_id in reservation_service.DEMO_CUSTOMERS:
        assert reservation_service.INSTAGRAM_ID_PATTERN.fullmatch(instagram_id)

    reservation_service.seed_demo_reservations(db)
    assert db.query(Reservation).count() == len(reservations)


def test_seed_demo_reservations_replaces_all(client: TestClient, db: Session):
    # 入れ直す時は、今ある予約をすべて消す
    reserve(client, "2026-10-12T01:00:00.000Z")

    reservation_service.seed_demo_reservations(db)

    assert db.query(Reservation).filter(Reservation.customer_name == "山田").count() == 0


def test_demo_reservations_expire(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch):
    # デモ中に作った予約は5分たったら消え、同じ時間にまた予約できる。ダミーの予約は消えない
    start = datetime(2026, 10, 12, 12, 0)
    monkeypatch.setattr(reservation_service, "now_utc", lambda: start)
    reservation_service.seed_demo_reservations(db)
    demo_count = db.query(Reservation).count()
    monkeypatch.setattr(reservation_service, "now_utc", lambda: start + timedelta(minutes=1))
    reserve(client, "2030-01-08T01:00:00.000Z")

    monkeypatch.setattr(reservation_service, "now_utc", lambda: start + timedelta(minutes=5))
    assert len(client.get("/reservations").json()["reservations"]) == demo_count + 1

    monkeypatch.setattr(reservation_service, "now_utc", lambda: start + timedelta(minutes=6))
    assert len(client.get("/reservations").json()["reservations"]) == demo_count
    assert reserve(client, "2030-01-08T01:00:00.000Z").status_code == 200


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
