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
  ReservationsResponse,
} from '../types/index.ts';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// 失敗したレスポンスから、APIが返したエラーメッセージ（detail）を取り出して投げる
async function throwApiError(res: Response, fallback: string): Promise<never> {
  const errorData: ApiErrorResponse | null = await res.json().catch(() => null);
  const detail: string = errorData && typeof errorData.detail === 'string' ? errorData.detail : fallback;
  throw new Error(detail);
}

// 確定済みの予約をすべて取得する
export async function fetchReservations(): Promise<ReservationItem[]> {
  const res: Response = await fetch(`${API_BASE_URL}/reservations`);
  if (!res.ok) await throwApiError(res, '予約データの取得に失敗しました。');
  const data: ReservationsResponse = await res.json();
  return data.reservations;
}

// 新しく作られた順に予約履歴を取得する
export async function fetchHistory(): Promise<HistoryItem[]> {
  const res: Response = await fetch(`${API_BASE_URL}/history`);
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, 'メニューの追加に失敗しました。');
  return res.json();
}

// メニューを書き換える
export async function updateMenu(id: number, body: MenuRequest): Promise<MenuInfo> {
  const res: Response = await fetch(`${API_BASE_URL}/menus/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, 'メニューの保存に失敗しました。');
  return res.json();
}

// メニューを削除する
export async function deleteMenu(id: number): Promise<void> {
  const res: Response = await fetch(`${API_BASE_URL}/menus/${id}`, { method: 'DELETE' });
  if (!res.ok) await throwApiError(res, 'メニューの削除に失敗しました。');
}
