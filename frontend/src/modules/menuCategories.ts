import type { MenuCategory } from "../types/index.ts";

// メニューの大きい項目（固定）。バックエンドの schemas/menus.py の MenuCategory と揃える
export const MENU_CATEGORIES: MenuCategory[] = [
  { id: "cut", name: "カット", icon: "/images/barbershop.png" },
  { id: "perm", name: "パーマ", icon: "/images/barber-chair.png" },
  { id: "color", name: "カラー", icon: "/images/hairdresser.png" },
];
