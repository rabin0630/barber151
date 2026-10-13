import { fetchMenus } from "../services/apiClient.ts";
import type { MenuCategory, MenuInfo } from "../types/index.ts";
import { MENU_CATEGORIES } from "./menuCategories.ts";

const menuPageEL = document.getElementById("step-1-menu") as HTMLDivElement;

// メニューのカテゴリを作成する関数
function renderCategory(category: MenuCategory): HTMLDivElement {
  const menuCategoryEl: HTMLDivElement = document.createElement("div");
  menuCategoryEl.className = "menu-category";
  menuCategoryEl.id = `menu-category-${category.id}`;

  const menuCategoryTitleEl: HTMLHeadingElement = document.createElement("h3");
  menuCategoryTitleEl.className = "category-title";

  const menuCategoryIconEl: HTMLImageElement = document.createElement("img");
  menuCategoryIconEl.src = category.icon;
  menuCategoryIconEl.className = "category-icon";
  menuCategoryIconEl.width = 30;
  menuCategoryIconEl.height = 30;

  menuCategoryTitleEl.appendChild(menuCategoryIconEl);
  menuCategoryTitleEl.appendChild(document.createTextNode(category.name));
  menuCategoryEl.appendChild(menuCategoryTitleEl);
  return menuCategoryEl;
}

// メニューのカードを作成する関数
function renderMenuCard(menu: MenuInfo, isFirst: boolean): HTMLLabelElement {
  // --- menucard htmlを作成 ---
  const menuCardDiv: HTMLLabelElement = document.createElement("label");
  menuCardDiv.className = "menu-card";

  const menuRadioBtn: HTMLInputElement = document.createElement("input");
  menuRadioBtn.type = "radio";
  menuRadioBtn.name = "menu";
  menuRadioBtn.value = String(menu.id);
  // HTMLの仕様に合わせて、1つ目の項目にrequiredを付与
  menuRadioBtn.required = isFirst;

  const menuDetailsDiv: HTMLDivElement = document.createElement("div");
  menuDetailsDiv.className = "menu-details";

  const menuNameSpan: HTMLSpanElement = document.createElement("span");
  menuNameSpan.className = "menu-name";
  menuNameSpan.textContent = menu.name;

  const menuPriceSpan: HTMLSpanElement = document.createElement("span");
  menuPriceSpan.className = "menu-price";
  menuPriceSpan.textContent = `${menu.price.toLocaleString()}円`;

  menuDetailsDiv.appendChild(menuNameSpan);
  menuDetailsDiv.appendChild(menuPriceSpan);

  menuCardDiv.appendChild(menuRadioBtn);
  menuCardDiv.appendChild(menuDetailsDiv);
  return menuCardDiv;
}

/**
 * サーバーからメニューを取得し、Step1にカテゴリごとのカードを描画する
 * メニューが1件もないカテゴリは表示しない
 * @returns 取得したメニュー。失敗した時は空配列
 */
export async function loadMenus(): Promise<MenuInfo[]> {
  let menus: MenuInfo[];
  try {
    menus = await fetchMenus();
  } catch (e: unknown) {
    console.error('メニューの取得に失敗しました', e);
    menuPageEL.innerHTML = '<p style="text-align: center; color: #991b1b;">メニューを読み込めませんでした。時間をおいて再度お試しください。</p>';
    return [];
  }

  menuPageEL.innerHTML = '';
  let isFirst: boolean = true;
  MENU_CATEGORIES.forEach((category: MenuCategory) => {
    const categoryMenus: MenuInfo[] = menus.filter((menu: MenuInfo) => menu.category === category.id);
    if (categoryMenus.length === 0) return;

    const menuCategoryEl: HTMLDivElement = renderCategory(category);
    categoryMenus.forEach((menu: MenuInfo) => {
      menuCategoryEl.appendChild(renderMenuCard(menu, isFirst));
      isFirst = false;
    });
    menuPageEL.appendChild(menuCategoryEl);
  });
  return menus;
}
