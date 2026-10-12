"""予約のAPIのエンドポイント"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.dependencies import get_db
from src.schemas.reservations import (
    CreateReservationRequest,
    CreateReservationResponse,
    HistoryItem,
    HistoryResponse,
    ReservationItem,
    ReservationsResponse,
)
from src.services import reservation_service

router = APIRouter()


@router.get("/reservations", response_model=ReservationsResponse)
def get_reservations(db: Session = Depends(get_db)) -> ReservationsResponse:
    """GET /reservations: 確定済みの予約をすべて返す

    Args:
        db (Session): DBのセッション

    Returns:
        ReservationsResponse: 確定済みの予約
    """
    reservations = reservation_service.list_confirmed_reservations(db)
    return ReservationsResponse(
        reservations=[
            ReservationItem(
                start_datetime=r.start_datetime,
                end_datetime=r.end_datetime,
                menu_name=r.menu.name,
                customer_name=r.customer_name,
            )
            for r in reservations
        ]
    )


@router.get("/history", response_model=HistoryResponse)
def get_history(db: Session = Depends(get_db)) -> HistoryResponse:
    """GET /history: 新しく作られた順に予約を返す

    Args:
        db (Session): DBのセッション

    Returns:
        HistoryResponse: 新しい順の予約
    """
    reservations = reservation_service.list_history(db)
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
    request: CreateReservationRequest, db: Session = Depends(get_db)
) -> CreateReservationResponse:
    """POST /reservations: 予約を登録する

    Args:
        request (CreateReservationRequest): 予約の内容
        db (Session): DBのセッション

    Returns:
        CreateReservationResponse: 完了のメッセージ

    Raises:
        AppError: 登録できない時(reservation_service.create_reservationと同じ)

    Note:
        AppErrorは、main.pyの例外ハンドラーがエラーのレスポンスにする
    """
    reservation_service.create_reservation(
        db,
        request.name,
        request.instagram_id,
        request.phone_number,
        request.menu_id,
        request.reservation_date,
    )
    return CreateReservationResponse(message="予約が完了しました！")
