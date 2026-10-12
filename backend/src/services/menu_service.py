"""メニューの初期データの登録と、メニューの追加・更新・削除の処理"""
from sqlalchemy.orm import Session

from src.crud import menus_crud
from src.exceptions import AppError
from src.models import Menu

## (category, name, price, duration)。メニューが1件もない時だけ登録する
DEFAULT_MENUS: list[tuple[str, str, int, int]] = [
    ("cut", "フルコース", 6000, 1),
    ("cut", "カット", 4000, 1),
    ("perm", "濡れパン", 9000, 3),
    ("perm", "パンチパーマ", 9000, 3),
    ("perm", "ニグロ", 9000, 3),
    ("perm", "極道パーマ", 9000, 3),
    ("color", "カラー", 8000, 2),
]


def seed_menus(db: Session) -> None:
    """メニューが1件もなければDEFAULT_MENUSを登録し、コミットする

    管理画面で変えた内容を起動のたびに上書きしないよう、1件でもあれば何もしない。

    Args:
        db (Session): DBのセッション
    """
    if menus_crud.count_menus(db) > 0:
        return
    for category, name, price, duration in DEFAULT_MENUS:
        menus_crud.create_menu(db, category, name, price, duration)
    db.commit()


def list_menus(db: Session) -> list[Menu]:
    """削除されていないメニューをすべて返す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Menu]: 削除されていないメニュー
    """
    return menus_crud.get_active_menus(db)


def get_active_menu(db: Session, menu_id: int) -> Menu:
    """削除されていないメニューを1件返す

    Args:
        db (Session): DBのセッション
        menu_id (int): メニューID

    Returns:
        Menu: 見つかったメニュー

    Raises:
        AppError: メニューがない、または削除済みの時(404)
    """
    menu = menus_crud.get_menu_by_id(db, menu_id)
    if menu is None or not menu.is_active:
        raise AppError(404, "メニューが見つかりません。")
    return menu


def create_menu(db: Session, category: str, name: str, price: int, duration: int) -> Menu:
    """メニューを追加し、コミットする

    Args:
        db (Session): DBのセッション
        category (str): 大きい項目
        name (str): メニュー名
        price (int): 料金(円)
        duration (int): 所要時間(時間)

    Returns:
        Menu: 追加したメニュー
    """
    menu = menus_crud.create_menu(db, category, name, price, duration)
    db.commit()
    db.refresh(menu)
    return menu


def update_menu(db: Session, menu_id: int, category: str, name: str, price: int, duration: int) -> Menu:
    """メニューの内容を書き換え、コミットする

    すでに入っている予約の終了時刻は変えない。

    Args:
        db (Session): DBのセッション
        menu_id (int): メニューID
        category (str): 大きい項目
        name (str): メニュー名
        price (int): 料金(円)
        duration (int): 所要時間(時間)

    Returns:
        Menu: 書き換えたメニュー

    Raises:
        AppError: メニューがない、または削除済みの時(404)
    """
    menu = get_active_menu(db, menu_id)
    menu.category = category
    menu.name = name
    menu.price = price
    menu.duration = duration
    db.commit()
    db.refresh(menu)
    return menu


def delete_menu(db: Session, menu_id: int) -> None:
    """メニューを論理削除し、コミットする

    Args:
        db (Session): DBのセッション
        menu_id (int): メニューID

    Raises:
        AppError: メニューがない、または削除済みの時(404)
    """
    menu = get_active_menu(db, menu_id)
    menu.is_active = False
    db.commit()
