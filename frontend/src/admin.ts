import { loadMenuManager } from './modules/adminMenu.ts';
import { setupPhoneNumberInput } from './modules/phoneNumber.ts';
import { createReservation, fetchAdminReservations, fetchHistory } from './services/apiClient.ts';
import type { AdminReservation, HistoryItem, ReservationItem } from './types/index.ts';

const headerRow = document.getElementById('schedule-header') as HTMLTableRowElement;
const bodyElement = document.getElementById('schedule-body') as HTMLTableSectionElement;
const prevBtns = document.querySelectorAll('.prev-schedule-btn') as NodeListOf<HTMLButtonElement>;
const nextBtns = document.querySelectorAll('.next-schedule-btn') as NodeListOf<HTMLButtonElement>;
const dateJumpInput = document.getElementById('date-jump') as HTMLInputElement | null;

let currentStartDate: Date = new Date();
let daysToShow: number = window.innerWidth <= 600 ? 3 : 7;
let bookedReservations: AdminReservation[] = [];

// 日付ジャンプの初期設定
if (dateJumpInput) {
  const today: Date = new Date();
  const todayStr: string = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dateJumpInput.min = todayStr;
  
  const maxDate: Date = new Date();
  maxDate.setMonth(maxDate.getMonth() + 2);
  const maxStr: string = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
  dateJumpInput.max = maxStr;

  dateJumpInput.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.value) {
      currentStartDate = new Date(target.value);
      loadAndRenderSchedule();
    }
  });
}

// サーバーから予約情報を取得してカレンダーを描画する関数
async function loadAndRenderSchedule(): Promise<void> {
  try {
    const reservations: ReservationItem[] = await fetchAdminReservations();
    bookedReservations = reservations.map((r: ReservationItem): AdminReservation => ({
      start: new Date(r.start_datetime),
      end: new Date(r.end_datetime),
      menuName: r.menu_name,
      customerName: r.customer_name
    }));
  } catch (e: unknown) {
    console.error('予約データの取得に失敗しました', e);
  }
  renderSchedule(currentStartDate);
  loadHistory(); // カレンダー描画と一緒に履歴も読み込む
}

async function loadHistory(): Promise<void> {
  try {
    renderHistory(await fetchHistory());
  } catch (e: unknown) {
    console.error('履歴データの取得に失敗しました', e);
    // トークンが違う時などに気づけるよう、エラーを画面にも出す
    const historyList = document.getElementById('history-list') as HTMLUListElement;
    const li: HTMLLIElement = document.createElement('li');
    li.style.cssText = 'padding: 1rem; text-align: center; color: #991b1b;';
    li.textContent = e instanceof Error ? e.message : '履歴データの取得に失敗しました。';
    historyList.replaceChildren(li);
  }
}

function renderHistory(history: HistoryItem[]): void {
  const historyList = document.getElementById('history-list') as HTMLUListElement;
  historyList.innerHTML = '';
  
  if (history.length === 0) {
    historyList.innerHTML = '<li style="padding: 1rem; text-align: center; color: #6b7280;">履歴はありません</li>';
    return;
  }

  history.forEach((item: HistoryItem, index: number) => {
    const li: HTMLLIElement = document.createElement('li');
    li.style.padding = '1rem';
    if (index < history.length - 1) {
      li.style.borderBottom = '1px solid #e5e7eb';
    }
    
    // APIはUTC（末尾Z）で返すので、new Dateで端末の時刻（日本時間）になる
    const createdDate: Date = new Date(item.created_at);
    const formattedCreated: string = `${createdDate.getMonth() + 1}/${createdDate.getDate()} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
    
    const targetDate: Date = new Date(item.start_datetime);
    const dayOfWeek: string = ['日', '月', '火', '水', '木', '金', '土'][targetDate.getDay()];
    const formattedTarget: string = `${targetDate.getMonth() + 1}/${targetDate.getDate()}(${dayOfWeek}) ${targetDate.getHours()}:00`;
    
    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
        <span style="font-weight: bold; color: #111827; font-size: 1.05rem;">${item.customer_name} 様</span>
        <span style="font-size: 0.8rem; color: #6b7280;">${formattedCreated} に追加</span>
      </div>
      <div style="font-size: 0.9rem; color: #4b5563;">
        予約日時: <span style="font-weight: 600;">${formattedTarget}</span> / メニュー: <span style="font-weight: 600;">${item.menu_name}</span>
      </div>
    `;
    historyList.appendChild(li);
  });
}

window.addEventListener('resize', () => {
  const newDaysToShow: number = window.innerWidth <= 600 ? 3 : 7;
  if (newDaysToShow !== daysToShow) {
    daysToShow = newDaysToShow;
    renderSchedule(currentStartDate);
  }
});

loadAndRenderSchedule();
loadMenuManager();

nextBtns.forEach((btn: HTMLButtonElement) => {
  btn.addEventListener('click', () => {
    currentStartDate.setDate(currentStartDate.getDate() + daysToShow);
    renderSchedule(currentStartDate);
  });
});

prevBtns.forEach((btn: HTMLButtonElement) => {
  btn.addEventListener('click', () => {
    currentStartDate.setDate(currentStartDate.getDate() - daysToShow);
    renderSchedule(currentStartDate);
  });
});

function renderSchedule(startDate: Date): void {
  if (dateJumpInput) {
    const startStr: string = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    dateJumpInput.value = startStr;
  }

  const headerMonthRow = document.getElementById('schedule-header-month') as HTMLTableRowElement;
  headerMonthRow.innerHTML = '';
  headerRow.innerHTML = '';

  const thCorner: HTMLTableCellElement = document.createElement('th');
  thCorner.rowSpan = 2;
  thCorner.textContent = '日時';
  headerMonthRow.appendChild(thCorner);

  bodyElement.innerHTML = '';

  const dates: Date[] = [];
  let currentMonthStr: string = "";
  let currentMonthTh: HTMLTableCellElement | null = null;
  let colspanCount: number = 0;

  for (let i: number = 0; i < daysToShow; i++) {
    const d: Date = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayOfWeek: string = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    dates.push(d);
    
    const monthStr: string = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (monthStr !== currentMonthStr) {
      currentMonthTh = document.createElement('th');
      currentMonthTh.className = 'th-year-month';
      currentMonthTh.textContent = monthStr;
      headerMonthRow.appendChild(currentMonthTh);
      currentMonthStr = monthStr;
      colspanCount = 1;
    } else {
      colspanCount++;
      if (currentMonthTh) currentMonthTh.colSpan = colspanCount;
    }

    const th: HTMLTableCellElement = document.createElement('th');
    th.innerHTML = `<div class="th-date-num">${d.getDate()}</div><div class="th-day-of-week">${dayOfWeek}</div>`;
    
    if (d.getDay() === 1 || d.getDay() === 2) {
      th.classList.add('holiday-text');
    }
    headerRow.appendChild(th);
  }

  // 指定した日時から"開始する"予約データを返す関数
  const getStartingReservation = (date: Date, hour: number): AdminReservation | null => {
    const slotStart: Date = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);

    for (const res of bookedReservations) {
      if (res.start.getTime() === slotStart.getTime()) {
        return res;
      }
    }
    return null;
  };

  // 列（日付）ごとに、rowspanによってスキップするセルの数を管理する配列
  const skipCells: number[] = new Array<number>(daysToShow).fill(0);

  for (let hour: number = 8; hour <= 19; hour++) {
    const tr: HTMLTableRowElement = document.createElement('tr');
    const timeTd: HTMLTableCellElement = document.createElement('td');
    timeTd.textContent = `${hour}:00`;
    tr.appendChild(timeTd);

    dates.forEach((date: Date, index: number) => {
      if (skipCells[index] > 0) {
        // この枠は上の予約セルに結合（rowspan）されているため、セルを作らずにスキップ
        skipCells[index]--;
        return;
      }

      const td: HTMLTableCellElement = document.createElement('td');
      const res: AdminReservation | null = getStartingReservation(date, hour);

      if (res) {
        // 予約の所要時間を計算
        const duration: number = Math.round((res.end.getTime() - res.start.getTime()) / (1000 * 60 * 60));
        // 管理者用として、メニュー名とお客様名をセルに表示
        td.innerHTML = `${res.menuName}<br><span style="font-size:0.7rem; color:#475569;">${res.customerName}</span>`;
        td.className = 'booked-cell';
        if (duration > 1) {
          td.rowSpan = duration; // セルを縦に結合
          skipCells[index] = duration - 1; // 結合した分だけ、下の時間のセル作成をスキップさせる
        }
      } else {
        const slotStart: Date = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        
        if (date.getDay() === 1 || date.getDay() === 2 || slotStart < new Date()) {
          td.textContent = '-';
          td.className = 'holiday';
        } else {
          td.textContent = '＋';
          td.className = 'holiday clickable-cell';
          td.style.color = '#2563eb';
          td.style.fontWeight = 'bold';
          td.title = '電話予約を追加する';
          td.onclick = () => openReservationModal(slotStart);
        }
      }
      tr.appendChild(td);
    });
    bodyElement.appendChild(tr);
  }
}

// モーダル制御と送信処理
const modal = document.getElementById('admin-reservation-modal') as HTMLDivElement;
const modalDatetimeDisplay = document.getElementById('modal-datetime-display') as HTMLParagraphElement;
const adminDatetimeInput = document.getElementById('admin-selected-datetime') as HTMLInputElement;
const adminForm = document.getElementById('admin-reservation-form') as HTMLFormElement;
const cancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const adminStatusMessage = document.getElementById('admin-status-message') as HTMLDivElement;
const adminSubmitBtn = document.getElementById('admin-submit-btn') as HTMLButtonElement;
setupPhoneNumberInput(document.getElementById('admin-customer-phone') as HTMLInputElement);

function openReservationModal(slotStart: Date): void {
  const dayOfWeek: string = ['日', '月', '火', '水', '木', '金', '土'][slotStart.getDay()];
  modalDatetimeDisplay.textContent = `${slotStart.getMonth() + 1}/${slotStart.getDate()}(${dayOfWeek}) ${slotStart.getHours()}:00`;
  adminDatetimeInput.value = slotStart.toISOString();
  
  adminForm.reset();
  adminStatusMessage.style.display = 'none';
  adminSubmitBtn.textContent = '追加する';
  adminSubmitBtn.disabled = false;
  
  modal.style.display = 'flex';
}

cancelBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

adminForm.addEventListener('submit', async (e: SubmitEvent) => {
  e.preventDefault();
  
  adminSubmitBtn.textContent = '処理中...';
  adminSubmitBtn.disabled = true;
  adminStatusMessage.style.display = 'none';

  const customerName: string = (document.getElementById('admin-customer-name') as HTMLInputElement).value;
  const instagramId: string = (document.getElementById('admin-customer-instagram') as HTMLInputElement).value;
  const phoneNumber: string = (document.getElementById('admin-customer-phone') as HTMLInputElement).value;
  const menuId: number = Number((document.getElementById('admin-menu-select') as HTMLSelectElement).value);
  const datetime: string = adminDatetimeInput.value;

  if (!instagramId.trim() && !phoneNumber.trim()) {
    adminStatusMessage.textContent = 'Instagram ID または 電話番号のどちらかを入力してください。';
    adminStatusMessage.style.display = 'block';
    adminStatusMessage.style.backgroundColor = '#fee2e2';
    adminStatusMessage.style.color = '#991b1b';
    adminSubmitBtn.textContent = '追加する';
    adminSubmitBtn.disabled = false;
    return;
  }

  try {
    await createReservation({
      name: customerName,
      instagram_id: instagramId,
      phone_number: phoneNumber,
      menu_id: menuId,
      reservation_date: datetime
    }, '送信に失敗しました。');
    
    modal.style.display = 'none';
    loadAndRenderSchedule(); // 成功したらモーダルを閉じてカレンダーを最新化
  } catch (error: unknown) {
    adminStatusMessage.textContent = error instanceof Error ? error.message : '送信に失敗しました。';
    adminStatusMessage.style.display = 'block';
    adminStatusMessage.style.backgroundColor = '#fee2e2';
    adminStatusMessage.style.color = '#991b1b';
    adminSubmitBtn.textContent = '追加する';
    adminSubmitBtn.disabled = false;
  }
});
