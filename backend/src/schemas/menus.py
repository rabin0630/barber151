"""メニューのAPIのリクエスト・レスポンスの型"""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

## 大きい項目。固定で、管理画面からは増やせない
MenuCategory = Literal["cut", "perm", "color"]


class MenuRequest(BaseModel):
    """POST /menus、PUT /menus/{menu_id}のリクエスト

    Attributes:
        category (MenuCategory): 大きい項目
        name (str): メニュー名。前後の空白は取り除く
        price (int): 料金(円)。0以上
        duration (int): 所要時間(時間)。営業時間(8:00〜20:00)に収まる1〜12
    """
    category: MenuCategory
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
    price: int = Field(ge=0)
    duration: int = Field(ge=1, le=12)


class MenuItem(BaseModel):
    """メニュー1件分

    Attributes:
        id (int): メニューID
        category (MenuCategory): 大きい項目
        name (str): メニュー名
        price (int): 料金(円)
        duration (int): 所要時間(時間)
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: MenuCategory
    name: str
    price: int
    duration: int


class MenusResponse(BaseModel):
    """GET /menusのレスポンス

    Attributes:
        menus (list[MenuItem]): 削除されていないメニュー
    """
    menus: list[MenuItem]
