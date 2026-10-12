"""メニューの読み書き。見つからなければNoneを返し、例外は投げない。コミットもしない"""
from sqlalchemy.orm import Session

from src.models import Menu


def get_menu_by_id(db: Session, menu_id: int) -> Menu | None:
    """メニューIDでメニューを1件探す。削除済みのメニューも返す

    Args:
        db (Session): DBのセッション
        menu_id (int): メニューID

    Returns:
        Menu | None: 見つかったメニュー。なければNone
    """
    return db.get(Menu, menu_id)


def get_active_menus(db: Session) -> list[Menu]:
    """削除されていないメニューを、登録した順にすべて返す

    Args:
        db (Session): DBのセッション

    Returns:
        list[Menu]: 削除されていないメニュー
    """
    return db.query(Menu).filter(Menu.is_active.is_(True)).order_by(Menu.id).all()


def count_menus(db: Session) -> int:
    """削除済みも含めて、メニューの件数を数える

    Args:
        db (Session): DBのセッション

    Returns:
        int: メニューの件数
    """
    return db.query(Menu).count()


def create_menu(db: Session, category: str, name: str, price: int, duration: int) -> Menu:
    """メニューを追加する。db.addだけ行い、コミットしない

    Args:
        db (Session): DBのセッション
        category (str): 大きい項目
        name (str): メニュー名
        price (int): 料金(円)
        duration (int): 所要時間(時間)

    Returns:
        Menu: 追加したメニュー
    """
    menu = Menu(category=category, name=name, price=price, duration=duration, is_active=True)
    db.add(menu)
    return menu
