// バックエンドAPIとの通信をまとめるモジュール
// 日時はすべてUTC（末尾Z付きのISO8601）でやり取りする

import type {
  ApiErrorResponse,
  CreateReservationRequest,
  HistoryItem,
  HistoryResponse,
  MenuInfo,
  MenuRequest,
  MenusResponse,
  ReservationItem,
  ReservationSlot,
  ReservationSlotsResponse,
  ReservationsResponse,
} from '../types/index.ts';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// 管理用のトークンを保存するsessionStorageのキー（タブを閉じると消える）
const ADMIN_TOKEN_KEY = 'barber151-admin-token';

// sessionStorageが使えない時に、このページの間だけトークンを持っておく
let memoryAdminToken: string = '';

// 保存した管理用のトークンを返す。なければ空文字
export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? memoryAdminToken;
  } catch {
    return memoryAdminToken;
  }
}

// 管理用のトークンを保存する。管理画面のモーダルで、正しいと確かめた後に呼ぶ
export function saveAdminToken(token: string): void {
  memoryAdminToken = token;
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // 保存できなくても、このページの間はmemoryAdminTokenで使える
  }
}

// 管理用APIに付けるAuthorizationヘッダー
function adminHeaders(token: string = getAdminToken()): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// トークンが正しいか、管理用API(GET /history)を呼んで確かめる
// 正しければtrue、401ならfalse。それ以外の失敗はErrorを投げる
export async function verifyAdminToken(token: string): Promise<boolean> {
  const res: Response = await fetch(`${API_BASE_URL}/history`, { headers: adminHeaders(token) });
  if (res.status === 401) return false;
  if (!res.ok) await throwApiError(res, 'トークンの確認に失敗しました。');
  return true;
}

// 失敗したレスポンスから、APIが返したエラーメッセージ（detail）を取り出して投げる
// 401の時は保存したトークンを消し、再読み込みで入力し直せるようにする
async function throwApiError(res: Response, fallback: string): Promise<never> {
  const errorData: ApiErrorResponse | null = await res.json().catch(() => null);
  let detail: string = errorData && typeof errorData.detail === 'string' ? errorData.detail : fallback;
  if (res.status === 401) {
    memoryAdminToken = '';
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // 保存していなければ消すものもない
    }
    detail += 'ページを再読み込みして、入力し直してください。';
  }
  throw new Error(detail);
}

// 確定済みの予約の時間帯をすべて取得する（予約フォーム用。お客様の情報は含まない）
export async function fetchReservations(): Promise<ReservationSlot[]> {
  const res: Response = await fetch(`${API_BASE_URL}/reservations`);
  if (!res.ok) await throwApiError(res, '予約データの取得に失敗しました。');
  const data: ReservationSlotsResponse = await res.json();
  return data.reservations;
}

// 確定済みの予約を、お客様の名前つきですべて取得する（管理画面用）
export async function fetchAdminReservations(): Promise<ReservationItem[]> {
  const res: Response = await fetch(`${API_BASE_URL}/admin/reservations`, { headers: adminHeaders() });
  if (!res.ok) await throwApiError(res, '予約データの取得に失敗しました。');
  const data: ReservationsResponse = await res.json();
  return data.reservations;
}

// 予約のメニューを変える。終了時刻はメニューの所要時間に合わせてサーバーが決める（管理画面用）
export async function changeReservationMenu(id: number, menuId: number): Promise<ReservationItem> {
  const res: Response = await fetch(`${API_BASE_URL}/admin/reservations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ menu_id: menuId }),
  });
  if (!res.ok) await throwApiError(res, 'メニューの変更に失敗しました。');
  return res.json();
}

// 予約のお客様の名前を書き換える（管理画面用）
export async function changeReservationName(id: number, customerName: string): Promise<ReservationItem> {
  const res: Response = await fetch(`${API_BASE_URL}/admin/reservations/${id}/name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ customer_name: customerName }),
  });
  if (!res.ok) await throwApiError(res, '名前の保存に失敗しました。');
  return res.json();
}

// 予約の連絡先（InstagramのIDと電話番号）を書き換える。2つとも今の値を送る（管理画面用）
export async function changeReservationContacts(
  id: number,
  contacts: { instagram_id: string | null; phone_number: string | null },
): Promise<ReservationItem> {
  const res: Response = await fetch(`${API_BASE_URL}/admin/reservations/${id}/contacts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(contacts),
  });
  if (!res.ok) await throwApiError(res, '連絡先の保存に失敗しました。');
  return res.json();
}

// 予約を取り消す（論理削除。管理画面用）
export async function cancelReservation(id: number): Promise<void> {
  const res: Response = await fetch(`${API_BASE_URL}/admin/reservations/${id}`, { method: 'DELETE', headers: adminHeaders() });
  if (!res.ok) await throwApiError(res, '予約の取り消しに失敗しました。');
}

// 新しく作られた順に予約履歴を取得する
export async function fetchHistory(): Promise<HistoryItem[]> {
  const res: Response = await fetch(`${API_BASE_URL}/history`, { headers: adminHeaders() });
  if (!res.ok) await throwApiError(res, '履歴データの取得に失敗しました。');
  const data: HistoryResponse = await res.json();
  return data.history;
}

// 予約を登録する。失敗した時はAPIのエラーメッセージ（なければfallback）でErrorを投げる
export async function createReservation(body: CreateReservationRequest, fallback: string): Promise<void> {
  const res: Response = await fetch(`${API_BASE_URL}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, fallback);
}

// 削除されていないメニューをすべて取得する
export async function fetchMenus(): Promise<MenuInfo[]> {
  const res: Response = await fetch(`${API_BASE_URL}/menus`);
  if (!res.ok) await throwApiError(res, 'メニューの取得に失敗しました。');
  const data: MenusResponse = await res.json();
  return data.menus;
}

// メニューを追加する
export async function createMenu(body: MenuRequest): Promise<MenuInfo> {
  const res: Response = await fetch(`${API_BASE_URL}/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, 'メニューの追加に失敗しました。');
  return res.json();
}

// メニューを書き換える
export async function updateMenu(id: number, body: MenuRequest): Promise<MenuInfo> {
  const res: Response = await fetch(`${API_BASE_URL}/menus/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, 'メニューの保存に失敗しました。');
  return res.json();
}

// メニューを削除する
export async function deleteMenu(id: number): Promise<void> {
  const res: Response = await fetch(`${API_BASE_URL}/menus/${id}`, { method: 'DELETE', headers: adminHeaders() });
  if (!res.ok) await throwApiError(res, 'メニューの削除に失敗しました。');
}
