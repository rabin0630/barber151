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

// 保存した管理用のトークンを返す。なければ入力してもらう
function getAdminToken(): string {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    // sessionStorageが使えない時は、毎回入力してもらう
  }
  if (!token) {
    token = window.prompt('管理用のトークンを入力してください') ?? '';
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch {
      // 保存できなくても、このリクエストには使える
    }
  }
  return token;
}

// 管理用APIに付けるAuthorizationヘッダー
function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getAdminToken()}` };
}

// 失敗したレスポンスから、APIが返したエラーメッセージ（detail）を取り出して投げる
// 401の時は保存したトークンを消し、再読み込みで入力し直せるようにする
async function throwApiError(res: Response, fallback: string): Promise<never> {
  const errorData: ApiErrorResponse | null = await res.json().catch(() => null);
  let detail: string = errorData && typeof errorData.detail === 'string' ? errorData.detail : fallback;
  if (res.status === 401) {
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
