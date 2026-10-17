// ==========================================
// 画面側で使う型定義
// ==========================================

/** メニューのカテゴリ種別 */
export type MenuType = 'cut' | 'perm' | 'color';

/** メニュー1件の情報（GET /menus の1件） */
export interface MenuInfo {
  id: number;
  category: MenuType;
  name: string;
  price: number;
  duration: number; // in hours
}

/** メニューのカテゴリ */
export interface MenuCategory {
  id: MenuType;
  name: string;
  icon: string;
}

/** 予約フォームのステップ番号 */
export type Step = 1 | 2 | 3;

/** スケジュール1枠の状態 */
export type SlotStatus = 'unavailable' | 'booked' | 'available';

/** カレンダー描画用の予約（開始・終了時刻） */
export interface Reservation {
  start: Date;
  end: Date;
}

/** 管理画面のカレンダー描画用の予約 */
export interface AdminReservation extends Reservation {
  menuName: string;
  customerName: string;
  instagramId: string | null;
}

// ==========================================
// API の型定義（日時はUTCのISO8601文字列）
// ==========================================

/** GET /reservations の予約1件（時間帯だけ） */
export interface ReservationSlot {
  start_datetime: string;
  end_datetime: string;
}

/** GET /reservations のレスポンス */
export interface ReservationSlotsResponse {
  reservations: ReservationSlot[];
}

/** GET /admin/reservations の予約1件 */
export interface ReservationItem {
  start_datetime: string;
  end_datetime: string;
  menu_name: string;
  customer_name: string;
  instagram_id: string | null;
}

/** GET /admin/reservations のレスポンス */
export interface ReservationsResponse {
  reservations: ReservationItem[];
}

/** GET /history の履歴1件 */
export interface HistoryItem {
  created_at: string;
  customer_name: string;
  start_datetime: string;
  menu_name: string;
}

/** GET /history のレスポンス */
export interface HistoryResponse {
  history: HistoryItem[];
}

/** GET /menus のレスポンス */
export interface MenusResponse {
  menus: MenuInfo[];
}

/** POST /menus、PUT /menus/{id} のリクエスト */
export type MenuRequest = Omit<MenuInfo, 'id'>;

/** POST /reservations のリクエスト */
export interface CreateReservationRequest {
  name: string;
  instagram_id: string;
  phone_number: string;
  menu_id: number;
  reservation_date: string;
}

/** APIのエラーレスポンス */
export interface ApiErrorResponse {
  detail?: unknown;
}
