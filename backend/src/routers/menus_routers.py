"""メニューのAPIのエンドポイント"""
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from src.dependencies import get_db, require_admin
from src.schemas.menus import MenuItem, MenuRequest, MenusResponse
from src.services import menu_service

router = APIRouter()


@router.get("/menus", response_model=MenusResponse)
def get_menus(db: Session = Depends(get_db)) -> MenusResponse:
    """GET /menus: 削除されていないメニューをすべて返す

    Args:
        db (Session): DBのセッション

    Returns:
        MenusResponse: 削除されていないメニュー
    """
    menus = menu_service.list_menus(db)
    return MenusResponse(menus=[MenuItem.model_validate(m) for m in menus])


@router.post("/menus", response_model=MenuItem, dependencies=[Depends(require_admin)])
def create_menu(request: MenuRequest, db: Session = Depends(get_db)) -> MenuItem:
    """POST /menus: メニューを追加する

    Args:
        request (MenuRequest): メニューの内容
        db (Session): DBのセッション

    Returns:
        MenuItem: 追加したメニュー
    """
    menu = menu_service.create_menu(db, request.category, request.name, request.price, request.duration)
    return MenuItem.model_validate(menu)


@router.put("/menus/{menu_id}", response_model=MenuItem, dependencies=[Depends(require_admin)])
def update_menu(menu_id: int, request: MenuRequest, db: Session = Depends(get_db)) -> MenuItem:
    """PUT /menus/{menu_id}: メニューを書き換える

    Args:
        menu_id (int): メニューID
        request (MenuRequest): メニューの内容
        db (Session): DBのセッション

    Returns:
        MenuItem: 書き換えたメニュー

    Raises:
        AppError: メニューがない、または削除済みの時(404)
    """
    menu = menu_service.update_menu(
        db, menu_id, request.category, request.name, request.price, request.duration
    )
    return MenuItem.model_validate(menu)


@router.delete("/menus/{menu_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_menu(menu_id: int, db: Session = Depends(get_db)) -> Response:
    """DELETE /menus/{menu_id}: メニューを削除する(論理削除)

    Args:
        menu_id (int): メニューID
        db (Session): DBのセッション

    Returns:
        Response: 中身のない204のレスポンス

    Raises:
        AppError: メニューがない、または削除済みの時(404)
    """
    menu_service.delete_menu(db, menu_id)
    return Response(status_code=204)
