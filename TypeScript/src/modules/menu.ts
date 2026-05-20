const menuPageEL = document.getElementById("step-1-menu");

interface MenuInfo {
  id: string;
  name: string;
  price: number;
  duration: number; // in hours
  type: string;
}
interface Menucategory {
  id: string;
  name: string;
  icon: string;
}

const icons = [
  "/src/images/barbershop.png",
  "/src/images/barber-chair.png",
  "/src/images/hairdresser.png",
];

const menus: MenuInfo[] = [
  { id: "cut_full", name: "フルコース", price: 6000, duration: 1, type: "cut" },
  { id: "cut", name: "カット", price: 4000, duration: 1, type: "cut" },
  {
    id: "perm_nurepan",
    name: "濡れパン",
    price: 9000,
    duration: 3,
    type: "perm",
  },
  {
    id: "perm_punch",
    name: "パンチパーマ",
    price: 9000,
    duration: 3,
    type: "perm",
  },
  { id: "perm_niguro", name: "ニグロ", price: 9000, duration: 3, type: "perm" },
  {
    id: "perm_gokudo",
    name: "極道パーマ",
    price: 9000,
    duration: 3,
    type: "perm",
  },
  { id: "color", name: "カラー", price: 8000, duration: 2, type: "color" },
];
// const MENUCATEGORY = {
//     cut:{name:"カット", icon: icons[0]},
//     perm:{name:"パーマ", icon: icons[1]},
//     color:{name:"カラー", icon: icons[2]}
// }

// const menucategory ={
//     name:"カット",
//     price:500
// };

const menuCategories: Menucategory[] = [
  { id: "cut", name: "ブス", icon: icons[0] },
  { id: "perm", name: "パーマ", icon: icons[1] },
  { id: "color", name: "カラー", icon: icons[2] },
];

menuCategories.forEach((category) => {
  let menuCategoryEl = document.createElement("div");
  menuCategoryEl.className = "menu-category";
  menuCategoryEl.id = `menu-category-${category.id}`;

  let menuCategoryTitleEl = document.createElement("h3");
  menuCategoryTitleEl.className = "category-title";

  let menuCategoryIconEl = document.createElement("img");
  menuCategoryIconEl.src = category.icon;
  menuCategoryIconEl.className = "category-icon";
  menuCategoryIconEl.width = 30;
  menuCategoryIconEl.height = 30;

  menuCategoryTitleEl.appendChild(menuCategoryIconEl);
  menuCategoryTitleEl.appendChild(document.createTextNode(category.name));
  menuCategoryEl.appendChild(menuCategoryTitleEl);
  menuPageEL.appendChild(menuCategoryEl);
});
// function makeMenucard(MENUCATEGORY) {
//     let menuCategoryEl = document.createElement('div');
//     menuCategoryEl.className = 'menu-category';
//     menuCategoryEl.id = `menu-category-${MENUCATEGORY.id}`;

//     let menuCategoryTitleEl = document.createElement('h3');
//     menuCategoryTitleEl.className = 'category-title';

//     let menuCategoryIconEl = document.createElement('img');
//     menuCategoryIconEl.src = MENUCATEGORY.icon;
//     menuCategoryIconEl.className = 'category-icon';
//     menuCategoryIconEl.width = 30;
//     menuCategoryIconEl.height = 30;

//     menuCategoryTitleEl.appendChild(menuCategoryIconEl);
//     menuCategoryTitleEl.appendChild(document.createTextNode(MENUCATEGORY.name));
//     menuCategoryEl.appendChild(menuCategoryTitleEl);
//     menuPageEL.appendChild(menuCategoryEl);
// }

menus.forEach((menu) => {
  let targetContainer: HTMLElement | null = null;

  targetContainer = document.getElementById(`menu-category-${menu.type}`);
  if (!targetContainer) return;

  // --- menucard htmlを作成 ---
  const menuCardDiv = document.createElement("label");
  menuCardDiv.className = "menu-card";

  const menuRadioBtn = document.createElement("input");
  menuRadioBtn.type = "radio";
  menuRadioBtn.name = "menu";
  menuRadioBtn.value = menu.id;
  // HTMLの仕様に合わせて、1つ目の項目にrequiredを付与
  if (menu.id === "cut_full") {
    menuRadioBtn.required = true;
  }

  const menuDetailsDiv = document.createElement("div");
  menuDetailsDiv.className = "menu-details";

  const menuNameSpan = document.createElement("span");
  menuNameSpan.className = "menu-name";
  menuNameSpan.textContent = menu.name;

  const menuPriceSpan = document.createElement("span");
  menuPriceSpan.className = "menu-price";
  menuPriceSpan.textContent = `${menu.price.toLocaleString()}円`;

  menuDetailsDiv.appendChild(menuNameSpan);
  menuDetailsDiv.appendChild(menuPriceSpan);

  menuCardDiv.appendChild(menuRadioBtn);
  menuCardDiv.appendChild(menuDetailsDiv);

  targetContainer.appendChild(menuCardDiv);
});
