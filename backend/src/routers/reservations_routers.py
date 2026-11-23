"""予約のAPIのエンドポイント"""
from fastapi import APIRouter, Depends, Response

from src.dependencies import get_reservation_service, require_admin
from src.models import Reservation
from src.schemas.reservations import (
    ChangeReservationContactsRequest,
    ChangeReservationMenuRequest,
    ChangeReservationNameRequest,
    CreateReservationRequest,
    CreateReservationResponse,
    HistoryItem,
    HistoryResponse,
    ReservationItem,
    ReservationSlot,
    ReservationSlotsResponse,
    ReservationsResponse,
)
from src.services.reservation_service import ReservationService

router = APIRouter()


@router.get("/reservations", response_model=ReservationSlotsResponse)
def get_reservation_slots(
    service: ReservationService = Depends(get_reservation_service),
) -> ReservationSlotsResponse:
    """GET /reservations: 確定済みの予約の時間帯をすべて返す。予約フォームで空きを出すのに使う

    Args:
        service (ReservationService): 予約のサービス

    Returns:
        ReservationSlotsResponse: 確定済みの予約の時間帯
    """
    reservations = service.list_confirmed()
    return ReservationSlotsResponse(
        reservations=[
            ReservationSlot(start_datetime=r.start_datetime, end_datetime=r.end_datetime)
            for r in reservations
        ]
    )


@router.get("/admin/reservations", response_model=ReservationsResponse, dependencies=[Depends(require_admin)])
def get_reservations(service: ReservationService = Depends(get_reservation_service)) -> ReservationsResponse:
    """GET /admin/reservations: 確定済みの予約を、お客様の名前つきですべて返す(管理用)

    Args:
        service (ReservationService): 予約のサービス

    Returns:
        ReservationsResponse: 確定済みの予約
    """
    reservations = service.list_confirmed()
    return ReservationsResponse(reservations=[to_reservation_item(r) for r in reservations])


def to_reservation_item(reservation: Reservation) -> ReservationItem:
    """予約を、管理用のレスポンスの1件分にする

    Args:
        reservation (Reservation): 予約。menuを読み込めること

    Returns:
        ReservationItem: 管理用のレスポンスの1件分
    """
    return ReservationItem(
        id=reservation.id,
        start_datetime=reservation.start_datetime,
        end_datetime=reservation.end_datetime,
        menu_id=reservation.menu_id,
        menu_name=reservation.menu.name,
        customer_name=reservation.customer_name,
        instagram_id=reservation.instagram_id,
        phone_number=reservation.phone_number,
    )


@router.patch(
    "/admin/reservations/{reservation_id}",
    response_model=ReservationItem,
    dependencies=[Depends(require_admin)],
)
def change_reservation_menu(
    reservation_id: int,
    request: ChangeReservationMenuRequest,
    service: ReservationService = Depends(get_reservation_service),
) -> ReservationItem:
    """PATCH /admin/reservations/{reservation_id}: 予約のメニューを変える(管理用)

    終了日時は、新しいメニューの所要時間に合わせて変わる。

    Args:
        reservation_id (int): 予約ID
        request (ChangeReservationMenuRequest): 新しいメニューID
        service (ReservationService): 予約のサービス

    Returns:
        ReservationItem: 変更した予約

    Raises:
        AppError: 変更できない時(ReservationService.change_menuと同じ)
    """
    reservation = service.change_menu(reservation_id, request.menu_id)
    return to_reservation_item(reservation)


@router.patch(
    "/admin/reservations/{reservation_id}/contacts",
    response_model=ReservationItem,
    dependencies=[Depends(require_admin)],
)
def change_reservation_contacts(
    reservation_id: int,
    request: ChangeReservationContactsRequest,
    service: ReservationService = Depends(get_reservation_service),
) -> ReservationItem:
    """PATCH /admin/reservations/{reservation_id}/contacts: 予約の連絡先を書き換える(管理用)

    Args:
        reservation_id (int): 予約ID
        request (ChangeReservationContactsRequest): 新しいInstagramのIDと電話番号
        service (ReservationService): 予約のサービス

    Returns:
        ReservationItem: 変更した予約

    Raises:
        AppError: 変更できない時(ReservationService.change_contactsと同じ)
    """
    reservation = service.change_contacts(
        reservation_id, request.instagram_id, request.phone_number
    )
    return to_reservation_item(reservation)


@router.patch(
    "/admin/reservations/{reservation_id}/name",
    response_model=ReservationItem,
    dependencies=[Depends(require_admin)],
)
def change_reservation_name(
    reservation_id: int,
    request: ChangeReservationNameRequest,
    service: ReservationService = Depends(get_reservation_service),
) -> ReservationItem:
    """PATCH /admin/reservations/{reservation_id}/name: 予約のお客様の名前を書き換える(管理用)

    Args:
        reservation_id (int): 予約ID
        request (ChangeReservationNameRequest): 新しい名前
        service (ReservationService): 予約のサービス

    Returns:
        ReservationItem: 変更した予約

    Raises:
        AppError: 変更できない時(ReservationService.change_nameと同じ)
    """
    reservation = service.change_name(reservation_id, request.customer_name)
    return to_reservation_item(reservation)


@router.delete(
    "/admin/reservations/{reservation_id}", status_code=204, dependencies=[Depends(require_admin)]
)
def cancel_reservation(
    reservation_id: int,
    service: ReservationService = Depends(get_reservation_service),
) -> Response:
    """DELETE /admin/reservations/{reservation_id}: 予約を取り消す(論理削除。管理用)

    Args:
        reservation_id (int): 予約ID
        service (ReservationService): 予約のサービス

    Returns:
        Response: 中身のない204のレスポンス

    Raises:
        AppError: 予約がない、またはすでに取り消し済みの時(404)
    """
    service.cancel(reservation_id)
    return Response(status_code=204)


@router.get("/history", response_model=HistoryResponse, dependencies=[Depends(require_admin)])
def get_history(service: ReservationService = Depends(get_reservation_service)) -> HistoryResponse:
    """GET /history: 新しく作られた順に予約を返す(管理用)

    Args:
        service (ReservationService): 予約のサービス

    Returns:
        HistoryResponse: 新しい順の予約
    """
    reservations = service.list_history()
    return HistoryResponse(
        history=[
            HistoryItem(
                created_at=r.created_at,
                customer_name=r.customer_name,
                start_datetime=r.start_datetime,
                menu_name=r.menu.name,
            )
            for r in reservations
        ]
    )


@router.post("/reservations", response_model=CreateReservationResponse)
def create_reservation(
    request: CreateReservationRequest,
    service: ReservationService = Depends(get_reservation_service),
) -> CreateReservationResponse:
    """POST /reservations: 予約を登録する

    Args:
        request (CreateReservationRequest): 予約の内容
        service (ReservationService): 予約のサービス

    Returns:
        CreateReservationResponse: 完了のメッセージ

    Raises:
        AppError: 登録できない時(ReservationService.createと同じ)

    Note:
        AppErrorは、main.pyの例外ハンドラーがエラーのレスポンスにする
    """
    service.create(
        request.name,
        request.instagram_id,
        request.phone_number,
        request.menu_id,
        request.reservation_date,
    )
    return CreateReservationResponse(message="予約が完了しました！")
