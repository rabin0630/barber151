import { loadMenuManager } from './modules/adminMenu.ts';
import { setupPhoneNumberInput } from './modules/phoneNumber.ts';
import { startAdminTutorialOnLoad } from './modules/adminTutorial.ts';
import { cancelReservation, changeReservationContacts, changeReservationMenu, changeReservationName, createReservation, fetchAdminReservations, fetchHistory, getAdminToken, saveAdminToken, verifyAdminToken } from './services/apiClient.ts';

import type { AdminReservation, HistoryItem, ReservationItem } from './types/index.ts';

const headerRow = document.getElementById('schedule-header') as HTMLTableRowElement;
const bodyElement = document.getElementById('schedule-body') as HTMLTableSectionElement;
const prevBtns = document.querySelectorAll('.prev-schedule-btn') as NodeListOf<HTMLButtonElement>;
const nextBtns = document.querySelectorAll('.next-schedule-btn') as NodeListOf<HTMLButtonElement>;
const dateJumpInput = document.getElementById('date-jump') as HTMLInputElement | null;

/** 表に表示する最初の日 */
let currentStartDate: Date = new Date();
/** 表に表示する日数。スマートフォンは3日、PCは7日 */
let daysToShow: number = window.innerWidth <= 600 ? 3 : 7;
/** サーバーから取得した予約の一覧 */
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

/** APIの予約1件を、カレンダー描画用の形にする */
function toAdminReservation(r: ReservationItem): AdminReservation {
  return {
    id: r.id,
    start: new Date(r.start_datetime),
    end: new Date(r.end_datetime),
    menuId: r.menu_id,
    menuName: r.menu_name,
    customerName: r.customer_name,
    instagramId: r.instagram_id,
    phoneNumber: r.phone_number
  };
}

/** サーバーから予約情報を取得してカレンダーを描画する関数 */
async function loadAndRenderSchedule(): Promise<void> {
  try {
    const reservations: ReservationItem[] = await fetchAdminReservations();
    bookedReservations = reservations.map(toAdminReservation);
  } catch (e: unknown) {
    console.error('予約データの取得に失敗しました', e);
  }
  renderSchedule(currentStartDate);
  // チュートリアルが、予約一覧を読み込み終わったか確かめるのに使う
  adminMain.dataset.loaded = 'true';
  loadHistory(); // カレンダー描画と一緒に履歴も読み込む
}

/** 予約追加の履歴を取得して描画する。失敗した時は、エラーを履歴の欄に出す */
async function loadHistory(): Promise<void> {
  try {
    renderHistory(await fetchHistory());
  } catch (e: unknown) {
    console.error('履歴データの取得に失敗しました', e);
    // パスワードが違う時などに気づけるよう、エラーを画面にも出す
    const historyList = document.getElementById('history-list') as HTMLUListElement;
    const li: HTMLLIElement = document.createElement('li');
    li.style.cssText = 'padding: 1rem; text-align: center; color: #991b1b;';
    li.textContent = e instanceof Error ? e.message : '履歴データの取得に失敗しました。';
    historyList.replaceChildren(li);
  }
}

/** 予約追加の履歴を一覧に描画する */
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

// 管理画面に入る時のパスワード入力モーダル。予約や履歴は、パスワードが正しいと確かめてから読み込む
// パスワードはサーバーのADMIN_TOKENと同じ。ポートフォリオ用なので「test」にしてモーダルに書いている
const loginModal = document.getElementById('admin-login-modal') as HTMLDivElement;
const loginForm = document.getElementById('admin-login-form') as HTMLFormElement;
const loginTokenInput = document.getElementById('admin-login-token') as HTMLInputElement;
const loginMessage = document.getElementById('admin-login-message') as HTMLDivElement;
const loginSubmitBtn = document.getElementById('admin-login-submit-btn') as HTMLButtonElement;

const adminMain = document.getElementById('admin-main') as HTMLElement;
const adminFooter = document.getElementById('admin-footer') as HTMLElement;

/** モーダルを閉じて管理画面の中身を表示し、予約と履歴を読み込む */
async function enterAdmin(): Promise<void> {
  loginModal.style.display = 'none';
  adminMain.style.display = '';
  adminFooter.style.display = '';
  await loadAndRenderSchedule();
}

/** ログインモーダルにエラーを表示する */
function showLoginError(message: string): void {
  loginMessage.textContent = message;
  loginMessage.style.display = 'block';
  loginMessage.style.backgroundColor = '#fee2e2';
  loginMessage.style.color = '#991b1b';
}

loginForm.addEventListener('submit', async (e: SubmitEvent) => {
  e.preventDefault();
  const token: string = loginTokenInput.value.trim();

  loginSubmitBtn.textContent = '確認中...';
  loginSubmitBtn.disabled = true;
  loginMessage.style.display = 'none';

  try {
    if (await verifyAdminToken(token)) {
      saveAdminToken(token);
      enterAdmin();
      return;
    }
    showLoginError('パスワードが正しくありません。');
    loginTokenInput.select();
  } catch (error: unknown) {
    showLoginError(error instanceof Error ? error.message : 'パスワードの確認に失敗しました。');
  } finally {
    loginSubmitBtn.textContent = '入る';
    loginSubmitBtn.disabled = false;
  }
});

/**
 * このタブで一度入っていれば、保存したパスワードを確かめて、モーダルを出さずに入る
 * 確かめている間はモーダルも出さない(一瞬モーダルが見えてしまうのを防ぐ)
 */
async function restoreLogin(): Promise<void> {
  const savedToken: string = getAdminToken();
  if (savedToken) {
    try {
      if (await verifyAdminToken(savedToken)) {
        await enterAdmin();
        return;
      }
    } catch {
      // 確かめられない時は、モーダルで入力し直してもらう
    }
  }
  loginModal.style.display = 'flex';
  loginTokenInput.focus();
}

// ログインの確認が終わってから、予約画面のチュートリアルの続きを始める
restoreLogin().then(startAdminTutorialOnLoad);

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

/** startDateからdaysToShow日分の予約表を描画する。予約はカード、空き枠は「＋」、定休日と過ぎた時間は「-」にする */
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

  /** 指定した日時から"開始する"予約データを返す関数 */
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
        // 管理者用として、メニュー名・お客様名・InstagramのIDを押せるカードにして表示
        const card: HTMLDivElement = document.createElement('div');
        card.className = 'booking-card';
        const menuSpan: HTMLSpanElement = document.createElement('span');
        menuSpan.className = 'booking-card-menu';
        menuSpan.textContent = res.menuName;
        const nameSpan: HTMLSpanElement = document.createElement('span');
        nameSpan.className = 'booking-card-name';
        nameSpan.textContent = res.customerName;
        card.append(menuSpan, nameSpan);
        if (res.instagramId) {
          // InstagramのプロフィールへのリンクはモーダルにあるのでIDだけ出す
          const instagramSpan: HTMLSpanElement = document.createElement('span');
          instagramSpan.className = 'booking-card-instagram';
          instagramSpan.textContent = `@${res.instagramId.replace(/^@/, '')}`;
          card.append(instagramSpan);
        }
        td.append(card);
        td.className = 'booked-cell';
        // 押したら、お客様に連絡を取るためのモーダルを開く
        td.title = '連絡先を見る';
        td.onclick = () => openContactModal(res);
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

/** 電話予約を追加するモーダルを、押した枠の日時で開く */
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

// 予約セルを押した時の、お客様に連絡を取るためのモーダル
const contactModal = document.getElementById('admin-contact-modal') as HTMLDivElement;
const contactCustomerName = document.getElementById('contact-customer-name') as HTMLHeadingElement;
const contactName = document.getElementById('contact-name') as HTMLElement;
const contactDatetime = document.getElementById('contact-datetime') as HTMLElement;
const contactMenuSelect = document.getElementById('contact-menu-select') as HTMLSelectElement;
const contactPhone = document.getElementById('contact-phone') as HTMLElement;
const contactInstagram = document.getElementById('contact-instagram') as HTMLElement;
const contactCloseBtn = document.getElementById('contact-close-btn') as HTMLButtonElement;

/** 電話番号を090-1234-5678の形にする。11桁でなければそのまま */
function formatPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
}

/** 連絡先の値のボタン。押すと編集モーダルを開く。値がなければ「未登録」と出す */
function createContactValueButton(text: string | null, kind: ContactKind): HTMLButtonElement {
  const button: HTMLButtonElement = document.createElement('button');
  button.type = 'button';
  button.className = 'contact-value-btn';
  if (text) {
    button.textContent = text;
  } else {
    const empty: HTMLSpanElement = document.createElement('span');
    empty.className = 'contact-empty';
    empty.textContent = '未登録（追加する）';
    button.append(empty);
  }
  button.addEventListener('click', () => openContactEdit(kind));
  return button;
}

/** 連絡先モーダルの名前・電話番号・Instagramの欄を描く */
function renderContactValues(res: AdminReservation): void {
  contactCustomerName.textContent = `${res.customerName} 様`;
  contactName.replaceChildren(createContactValueButton(res.customerName, 'name'));
  contactPhone.replaceChildren(createContactValueButton(res.phoneNumber && formatPhoneNumber(res.phoneNumber), 'phone'));
  contactInstagram.replaceChildren(createContactValueButton(res.instagramId && `@${res.instagramId.replace(/^@/, '')}`, 'instagram'));
}

/** 連絡先モーダルで開いている予約。取り消しの時に使う */
let contactReservation: AdminReservation | null = null;

/** 予約日時を「10/18(日) 10:00 〜 11:00」の形にする */
function formatReservationTime(res: AdminReservation): string {
  const dayOfWeek: string = ['日', '月', '火', '水', '木', '金', '土'][res.start.getDay()];
  return `${res.start.getMonth() + 1}/${res.start.getDate()}(${dayOfWeek}) ${res.start.getHours()}:00 〜 ${res.end.getHours()}:00`;
}

/** 押した予約の連絡先モーダルを開く */
function openContactModal(res: AdminReservation): void {
  contactReservation = res;
  contactDatetime.textContent = formatReservationTime(res);
  selectContactMenu(res);

  renderContactValues(res);

  contactModal.style.display = 'flex';
  contactCloseBtn.focus();
}

/**
 * メニューの選択肢で、予約の今のメニューを選んでおく
 * 削除済みのメニューは選択肢にないので、選べない選択肢として一時的に足す
 */
function selectContactMenu(res: AdminReservation): void {
  contactMenuSelect.querySelector('option[data-removed-menu]')?.remove();
  contactMenuSelect.value = String(res.menuId);
  if (contactMenuSelect.value !== String(res.menuId)) {
    const option: HTMLOptionElement = new Option(`${res.menuName}（削除済み）`, String(res.menuId));
    option.disabled = true;
    option.dataset.removedMenu = '';
    contactMenuSelect.prepend(option);
    contactMenuSelect.value = String(res.menuId);
  }
}

// メニューを選んだ瞬間に変更する。延長できない時などは、エラーのモーダルを重ねて元のメニューに戻す
const changeMenuErrorModal = document.getElementById('change-menu-error-modal') as HTMLDivElement;
const changeMenuErrorMessage = document.getElementById('change-menu-error-message') as HTMLParagraphElement;
const changeMenuErrorCloseBtn = document.getElementById('change-menu-error-close-btn') as HTMLButtonElement;

contactMenuSelect.addEventListener('change', async () => {
  if (!contactReservation) return;
  const reservation: AdminReservation = contactReservation;
  contactMenuSelect.disabled = true;
  try {
    const updated: AdminReservation = toAdminReservation(await changeReservationMenu(reservation.id, Number(contactMenuSelect.value)));
    contactReservation = updated;
    contactDatetime.textContent = formatReservationTime(updated);
    selectContactMenu(updated);
    loadAndRenderSchedule(); // 長さが変わった分、カレンダーを描き直す
  } catch (error: unknown) {
    selectContactMenu(reservation);
    changeMenuErrorMessage.textContent = error instanceof Error ? error.message : 'メニューの変更に失敗しました。';
    changeMenuErrorModal.style.display = 'flex';
    changeMenuErrorCloseBtn.focus();
  } finally {
    contactMenuSelect.disabled = false;
  }
});

// 名前・電話番号・Instagramの編集モーダル
// 開いた時の値をsavedContactValueに置き、1文字打つたびに入力欄と比べて、違えば保存ボタンを出す
/** 編集モーダルで編集する項目 */
type ContactKind = 'name' | 'phone' | 'instagram';

/** 編集モーダルの見出し */
const CONTACT_EDIT_TITLES: Record<ContactKind, string> = { name: 'お名前', phone: '電話番号', instagram: 'Instagram' };

const contactEditModal = document.getElementById('contact-edit-modal') as HTMLDivElement;
const contactEditTitle = document.getElementById('contact-edit-title') as HTMLHeadingElement;
const contactEditBackBtn = document.getElementById('contact-edit-back-btn') as HTMLButtonElement;
const contactEditMessage = document.getElementById('contact-edit-message') as HTMLDivElement;
const contactEditAction = document.getElementById('contact-edit-action') as HTMLAnchorElement;
const contactEditFields: Record<ContactKind, HTMLDivElement> = {
  name: document.getElementById('contact-edit-name-field') as HTMLDivElement,
  phone: document.getElementById('contact-edit-phone-field') as HTMLDivElement,
  instagram: document.getElementById('contact-edit-instagram-field') as HTMLDivElement,
};
const contactEditInputs: Record<ContactKind, HTMLInputElement> = {
  name: document.getElementById('contact-edit-name') as HTMLInputElement,
  phone: document.getElementById('contact-edit-phone') as HTMLInputElement,
  instagram: document.getElementById('contact-edit-instagram') as HTMLInputElement,
};
setupPhoneNumberInput(contactEditInputs.phone);

/** 編集モーダルで開いている項目 */
let contactEditKind: ContactKind = 'phone';
/** 編集モーダルを開いた時(保存した後)の値。入力欄と比べて、保存ボタンを出すか決める */
let savedContactValue: string = '';

/** 保存してある値を、入力欄に出す形にする */
function contactInputValue(res: AdminReservation, kind: ContactKind): string {
  if (kind === 'name') return res.customerName;
  if (kind === 'phone') return res.phoneNumber ? formatPhoneNumber(res.phoneNumber) : '';
  return res.instagramId ? res.instagramId.replace(/^@/, '') : '';
}

/**
 * 比べるために値をそろえる。名前は前後の空白を除く。電話番号は数字だけ(全角は半角に)、InstagramはIDだけにする
 * 例: "090-1234-5678" と "09012345678" は同じ、"@barber" と "barber" は同じとみなす
 */
function normalizeContactValue(kind: ContactKind, value: string): string {
  if (kind === 'name') return value.trim();
  if (kind === 'phone') {
    return value.replace(/[０-９]/g, (c: string): string => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, '');
  }
  return value.trim().replace(/^@/, '');
}

/** 項目の保存ボタンを返す */
function saveButtonOf(kind: ContactKind): HTMLButtonElement {
  return contactEditFields[kind].querySelector('.contact-edit-save-btn') as HTMLButtonElement;
}

/** 「電話する」「Instagramを開く」のリンクを、保存してある値で作る。名前の時は出さない */
function renderContactEditAction(res: AdminReservation): void {
  contactEditAction.style.display = contactEditKind === 'name' ? 'none' : '';
  if (contactEditKind === 'phone') {
    contactEditAction.textContent = '📞 電話する';
    contactEditAction.removeAttribute('target');
    contactEditAction.removeAttribute('rel');
    contactEditAction.href = res.phoneNumber ? `tel:${res.phoneNumber}` : '#';
    contactEditAction.setAttribute('aria-disabled', String(!res.phoneNumber));
  } else {
    const instagramId: string = (res.instagramId ?? '').replace(/^@/, '');
    contactEditAction.textContent = 'Instagramを開く';
    contactEditAction.target = '_blank';
    contactEditAction.rel = 'noopener noreferrer';
    contactEditAction.href = instagramId ? `https://www.instagram.com/${encodeURIComponent(instagramId)}/` : '#';
    contactEditAction.setAttribute('aria-disabled', String(!instagramId));
  }
}

/** 項目の編集モーダルを、保存してある値で開く */
function openContactEdit(kind: ContactKind): void {
  if (!contactReservation) return;
  contactEditKind = kind;
  contactEditTitle.textContent = CONTACT_EDIT_TITLES[kind];
  (Object.keys(contactEditFields) as ContactKind[]).forEach((k: ContactKind) => {
    contactEditFields[k].style.display = k === kind ? '' : 'none';
  });

  savedContactValue = contactInputValue(contactReservation, kind);
  contactEditInputs[kind].value = savedContactValue;
  saveButtonOf(kind).style.display = 'none';
  contactEditMessage.style.display = 'none';
  renderContactEditAction(contactReservation);

  contactEditModal.style.display = 'flex';
  contactEditInputs[kind].focus();
}

/** 戻る(✕): 保存していない入力は捨てて、連絡先モーダルに戻る */
function closeContactEdit(): void {
  contactEditModal.style.display = 'none';
}
contactEditBackBtn.addEventListener('click', closeContactEdit);

(Object.keys(contactEditInputs) as ContactKind[]).forEach((kind: ContactKind) => {
  const input: HTMLInputElement = contactEditInputs[kind];
  const saveBtn: HTMLButtonElement = saveButtonOf(kind);

  // 1文字打つたびに、開いた時の値と比べる。違う時だけ保存ボタンを出す
  input.addEventListener('input', () => {
    const changed: boolean = normalizeContactValue(kind, input.value) !== normalizeContactValue(kind, savedContactValue);
    saveBtn.style.display = changed ? '' : 'none';
  });

  saveBtn.addEventListener('click', async () => {
    if (!contactReservation) return;
    const reservation: AdminReservation = contactReservation;
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;
    contactEditMessage.style.display = 'none';
    try {
      // 連絡先は、もう片方を今の値のまま送る
      const updated: AdminReservation = toAdminReservation(kind === 'name'
        ? await changeReservationName(reservation.id, input.value)
        : await changeReservationContacts(reservation.id, {
          phone_number: kind === 'phone' ? input.value : reservation.phoneNumber,
          instagram_id: kind === 'instagram' ? input.value : reservation.instagramId,
        }));
      contactReservation = updated;
      savedContactValue = contactInputValue(updated, kind);
      input.value = savedContactValue;
      saveBtn.style.display = 'none';
      renderContactValues(updated);
      renderContactEditAction(updated);
      loadAndRenderSchedule(); // カードの名前・InstagramのIDを新しくする
    } catch (error: unknown) {
      contactEditMessage.textContent = error instanceof Error ? error.message : '保存に失敗しました。';
      contactEditMessage.style.display = 'block';
      contactEditMessage.style.backgroundColor = '#fee2e2';
      contactEditMessage.style.color = '#991b1b';
    } finally {
      saveBtn.textContent = '保存';
      saveBtn.disabled = false;
    }
  });
});

/** メニュー変更のエラーモーダルを閉じて、メニューの選択に戻る */
function closeChangeMenuError(): void {
  changeMenuErrorModal.style.display = 'none';
  contactMenuSelect.focus();
}
changeMenuErrorCloseBtn.addEventListener('click', closeChangeMenuError);

/** 連絡先モーダルを閉じる */
function closeContactModal(): void {
  contactModal.style.display = 'none';
}

contactCloseBtn.addEventListener('click', closeContactModal);

// モーダルの外側(暗い部分)を押しても閉じる
contactModal.addEventListener('click', (e: MouseEvent) => {
  if (e.target === contactModal) closeContactModal();
});

// 「予約を取り消す」→ 確認モーダル →(はい)→ 完了モーダル
const contactCancelBtn = document.getElementById('contact-cancel-btn') as HTMLButtonElement;
const cancelConfirmModal = document.getElementById('cancel-confirm-modal') as HTMLDivElement;
const cancelConfirmDetail = document.getElementById('cancel-confirm-detail') as HTMLParagraphElement;
const cancelConfirmMessage = document.getElementById('cancel-confirm-message') as HTMLDivElement;
const cancelConfirmNoBtn = document.getElementById('cancel-confirm-no-btn') as HTMLButtonElement;
const cancelConfirmYesBtn = document.getElementById('cancel-confirm-yes-btn') as HTMLButtonElement;
const cancelDoneModal = document.getElementById('cancel-done-modal') as HTMLDivElement;
const cancelDoneCloseBtn = document.getElementById('cancel-done-close-btn') as HTMLButtonElement;

/** 完了モーダルが自動で消えるまでの時間(ミリ秒) */
const CANCEL_DONE_TIMEOUT_MS = 5000;
/** 完了モーダルを自動で閉じるタイマー */
let cancelDoneTimer: number | undefined;

// 確認モーダルを開く。連絡先モーダルは下に残しておく
contactCancelBtn.addEventListener('click', () => {
  if (!contactReservation) return;
  cancelConfirmDetail.textContent = `${contactReservation.customerName} 様の ${formatReservationTime(contactReservation)} の予約を取り消します。`;
  cancelConfirmMessage.style.display = 'none';
  cancelConfirmYesBtn.textContent = 'はい';
  cancelConfirmYesBtn.disabled = false;
  cancelConfirmModal.style.display = 'flex';
  cancelConfirmNoBtn.focus(); // 間違えてEnterを押しても消えないよう、いいえを選んでおく
});

/** いいえ: 確認モーダルだけ閉じて、連絡先モーダルに戻る */
function closeCancelConfirm(): void {
  cancelConfirmModal.style.display = 'none';
  contactCancelBtn.focus();
}
cancelConfirmNoBtn.addEventListener('click', closeCancelConfirm);

// はい: 予約を取り消し、モーダルを全部閉じて完了モーダルだけを出す
cancelConfirmYesBtn.addEventListener('click', async () => {
  if (!contactReservation) return;
  cancelConfirmYesBtn.textContent = '削除中...';
  cancelConfirmYesBtn.disabled = true;
  try {
    await cancelReservation(contactReservation.id);
  } catch (error: unknown) {
    cancelConfirmMessage.textContent = error instanceof Error ? error.message : '予約の取り消しに失敗しました。';
    cancelConfirmMessage.style.display = 'block';
    cancelConfirmMessage.style.backgroundColor = '#fee2e2';
    cancelConfirmMessage.style.color = '#991b1b';
    cancelConfirmYesBtn.textContent = 'はい';
    cancelConfirmYesBtn.disabled = false;
    return;
  }
  cancelConfirmModal.style.display = 'none';
  closeContactModal();
  openCancelDone();
  loadAndRenderSchedule(); // 取り消した予約をカレンダーから消す
});

/** 完了モーダルを開く。一定時間たつと自動で閉じる */
function openCancelDone(): void {
  cancelDoneModal.style.display = 'flex';
  cancelDoneCloseBtn.focus();
  cancelDoneTimer = window.setTimeout(closeCancelDone, CANCEL_DONE_TIMEOUT_MS);
}

/** 完了モーダルを閉じて、タイマーも止める */
function closeCancelDone(): void {
  window.clearTimeout(cancelDoneTimer);
  cancelDoneModal.style.display = 'none';
}
cancelDoneCloseBtn.addEventListener('click', closeCancelDone);

// Escキーでは、いちばん上のモーダルだけを閉じる
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  if (cancelDoneModal.style.display !== 'none') closeCancelDone();
  else if (changeMenuErrorModal.style.display !== 'none') closeChangeMenuError();
  else if (contactEditModal.style.display !== 'none') closeContactEdit();
  else if (cancelConfirmModal.style.display !== 'none') closeCancelConfirm();
  else if (contactModal.style.display !== 'none') closeContactModal();
});
