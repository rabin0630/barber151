// 宣言である
const form = document.getElementById('reservation-form');
const scheduleWrapper = document.getElementById('schedule-wrapper');
const headerRow = document.getElementById('schedule-header');
const bodyElement = document.getElementById('schedule-body');
const statusMessage = document.getElementById('status-message');
const dateJumpInput = document.getElementById('date-jump');
const prevBtns = document.querySelectorAll('.prev-schedule-btn');
const nextBtns = document.querySelectorAll('.next-schedule-btn');
const menuSelect = document.getElementById('menu-select');
const selectionSummary = document.getElementById('selection-summary');
const summaryMenu = document.getElementById('summary-menu');
const summaryDatetime = document.getElementById('summary-datetime');
const nameInput = document.getElementById('customer-name');
const instagramInput = document.getElementById('customer-instagram');
const phoneInput = document.getElementById('customer-phone');
const formContainer = document.getElementById('form-container');
const successContainer = document.getElementById('success-container');
const successDatetimeMsg = document.getElementById('success-datetime');
const backToHomeBtn = document.getElementById('back-to-home-btn');
const toastMessage = document.getElementById('toast-message');

/** 確定済みの予約データをすべて取得するurlである */
const ReservationUrl = 'http://localhost:8000/reservations';

// --- スケジュール表示の管理変数である ---
/** カレンダーに表示する最初の日である */
let currentStartDate = new Date();
/** セルの表示日数である */
const daysToShow = (window.innerWidth <= 600) ? 3 : 7; // スマホは3日、PCは7日 if文
/** 予約可能最大日である */
const maxDate = new Date();
maxDate.setMonth(maxDate.getMonth() + 2); // 2ヶ月先まで予約可能と設定

// 画面リサイズ時に表示日数を更新する
window.addEventListener('resize', () => {
  const newDaysToShow = window.innerWidth <= 600 ? 3 : 7;
  if (newDaysToShow !== daysToShow) {
    daysToShow = newDaysToShow;
    renderSchedule(currentStartDate);
  }
});

// 日付ジャンプの初期設定 @TODO
if (dateJumpInput) {
  // --- 1. カレンダーの選択可能範囲の設定 ---
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dateJumpInput.min = todayStr;
  const maxStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
  dateJumpInput.max = maxStr;
  
  // --- 2. イベントリスナーの登録 ---
  dateJumpInput.addEventListener('change', (event) => {
    if (event.target.value) {
      currentStartDate = new Date(event.target.value);
      loadAndRenderSchedule();
    }
  });
};

/** 決定した予約の開始時間と終了時間を格納している配列である */
let bookedReservations = [];

/** ---サーバーから予約情報を取得しカレンダーを描画する---
 * 1. 予約情報の開始時刻と終了時刻を配列に格納する
 * 2. スケジュールを描写するのである
*/
async function loadAndRenderSchedule() {
  try {
    const res = await fetch(ReservationUrl);
    if (res.ok) {
      const data = await res.json();
      bookedReservations = data.reservations.map(r => ({
        start: new Date(r.start_datetime),
        end: new Date(r.end_datetime),
      }));
    }
  } catch (e) {
    console.error('予約データの取得に失敗しました', e);
  }
  renderSchedule(currentStartDate);
}

let toastTimeout;

/** --エラーメッセージを表示する関数である--
 * 第一引数はテキストの挿入
 */
const showStatus = (text, isError = true) => {
  // --1.statusMessageの表示設定--
  statusMessage.textContent = text;
  statusMessage.style.display = 'block';
  statusMessage.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
  statusMessage.style.color = isError ? '#991b1b' : '#166534';

  // 画面中央のトーストにも表示して5秒で消す（3秒後から2秒かけてフェードアウト）
  // --2.エラーポップアップの表示設定--
  toastMessage.textContent = text;
  toastMessage.style.display = 'block';
  toastMessage.style.transition = 'none'; // パッと表示させる
  toastMessage.style.opacity = '1';

  if (toastTimeout) clearTimeout(toastTimeout); // エラーが連続して起きた場合のバグ処理
  toastTimeout = setTimeout(() => {
    toastMessage.style.transition = 'opacity 2s ease-out'; // 2秒かけて透明にする
    toastMessage.style.opacity = '0';
    setTimeout(() => {
      if (toastMessage.style.opacity === '0') toastMessage.style.display = 'none';
    }, 2000);
  }, 3000);
};

/**
 * 選択したメニューを選択内容欄に表示する関数である
 * 1. 選択したメニューの表示
 * 2. 選択した予約日付の表示、時間計算
 */
const updateSummary = () => {
  /** ---1. 選択したメニューの表示--- */
  // 選択したメニューのoption要素を代入
  const selectedMenuOption = menuSelect.options[menuSelect.selectedIndex]
  // 選択したメニューのvalueを代入
  const menuVal = menuSelect.value;
  // 選択内容欄に選択したメニューの表示
  summaryMenu.textContent = selectedMenuOption.value ? selectedMenuOption.text : '未選択';

  /** --2. 選択した予約日付の表示、時間計算 */
  // 施術時間の設定
  let duration = 0;
  if (menuVal === 'cut') { duration = 1; }
  else if (menuVal === 'color') { duration = 2; }
  else if (menuVal === 'perm') { duration = 3; }
  const datetimeVal = document.getElementById('selected-datetime').value;
  if (datetimeVal) {
    const d = new Date(datetimeVal);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    // 所要時間がある場合は終了時間を計算して表示。メニュー未選択の時は1時間とする
    const endHour = d.getHours() + (duration || 1);
    summaryDatetime.textContent = `${d.getMonth() + 1}/${d.getDate()}(${dayOfWeek}) ${d.getHours()}:00 〜 ${endHour}:00`;
  } else {
    summaryDatetime.textContent = '未選択';
  }

  // 何かが選択されたら選択内容欄の表示
  if (menuSelect.value || datetimeVal) {
    selectionSummary.style.display = 'block';
  } else {
    selectionSummary.style.display = 'none';
  }
};

// メニュー変更時にサマリーとスケジュールを更新
menuSelect.addEventListener('change', () => {
  document.getElementById('selected-datetime').value = ''; // 必要な枠数が変わるため選択日時をリセット
  updateSummary();
  renderSchedule(currentStartDate);
});


// 初期表示としてスケジュールを生成
loadAndRenderSchedule();

// 矢印ボタンのイベントリスナー（復活）
nextBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentStartDate.setDate(currentStartDate.getDate() + daysToShow);
    renderSchedule(currentStartDate);
  });
});

prevBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentStartDate.setDate(currentStartDate.getDate() - daysToShow);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 今日より過去には戻れないように制限
    if (currentStartDate < today) {
      currentStartDate = new Date(today);
    }
    renderSchedule(currentStartDate);
  });
});

/**スケジュールを描写する関数である
 * 第一引数にはスケジュール開始日を渡すのである
 */
function renderSchedule(startDate) {
  if (dateJumpInput) {
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    dateJumpInput.value = startStr;
  }

  const headerMonthRow = document.getElementById('schedule-header-month');
  headerMonthRow.innerHTML = '';
  headerRow.innerHTML = '';

  const thCorner = document.createElement('th');
  thCorner.rowSpan = 2;
  thCorner.textContent = '日時';
  headerMonthRow.appendChild(thCorner);

  bodyElement.innerHTML = '';

  const dates = [];
  let currentMonthStr = "";
  let currentMonthTh = null;
  let colspanCount = 0;

  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    dates.push(d);
    
    const monthStr = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (monthStr !== currentMonthStr) {
      currentMonthTh = document.createElement('th');
      currentMonthTh.className = 'th-year-month';
      currentMonthTh.textContent = monthStr;
      headerMonthRow.appendChild(currentMonthTh);
      currentMonthStr = monthStr;
      colspanCount = 1;
    } else {
      colspanCount++;
      currentMonthTh.colSpan = colspanCount;
    }

    const th = document.createElement('th');
    th.innerHTML = `<div class="th-date-num">${d.getDate()}</div><div class="th-day-of-week">${dayOfWeek}</div>`;
    
    if (d.getDay() === 1 || d.getDay() === 2) {
      th.classList.add('holiday-text');
    }
    headerRow.appendChild(th);
  }

  // 現在時刻と比較して、過去の時間をグレーアウトするための準備
  const now = new Date();

  // 選択されたメニューの所要時間を取得
  const menuVal = menuSelect.value;
  let duration = 1; // 未選択またはカットは1時間
  if (menuVal === 'color') duration = 2;
  if (menuVal === 'perm') duration = 3;

  // 1枠単体が空いているか判定する関数
  const getSlotStatus = (date, startHour) => {
    const day = date.getDay();
    const slotStart = new Date(date);
    slotStart.setHours(startHour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(startHour + 1, 0, 0, 0); // 1枠は1時間

    if (day === 1 || day === 2 || slotStart < now) return 'unavailable';

    // その時間自体に予約が入っているか
    for (const res of bookedReservations) {
      if (res.start < slotEnd && res.end > slotStart) {
        return 'booked'; // 確実に他人の予約が入っている
      }
    }
    return 'available';
  };

  for (let hour = 8; hour <= 19; hour++) {
    const tr = document.createElement('tr');
    const timeTd = document.createElement('td');
    timeTd.textContent = `${hour}:00`;
    tr.appendChild(timeTd);

    dates.forEach(date => {
      const td = document.createElement('td');
      
      // 判定用の日時オブジェクトを作成（その日の該当時間）
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);

      const status = getSlotStatus(date, hour);

      if (status === 'unavailable') {
        td.textContent = '-';
        td.className = 'holiday';
      } else if (status === 'booked') {
        td.textContent = '❌';
        td.className = 'holiday';
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '○';
        btn.className = 'time-slot-btn';
        btn.dataset.datetime = slotTime.toISOString();

        // カレンダー切り替え時などに、すでに選択済みの時間ならスタイルを復元
        const currentSelected = document.getElementById('selected-datetime').value;
        if (currentSelected) {
          for (let i = 0; i < duration; i++) {
            const targetTime = new Date(currentSelected);
            targetTime.setHours(targetTime.getHours() + i);
            if (targetTime.getTime() === slotTime.getTime()) {
              btn.classList.add('selected');
            }
          }
        }

        btn.onclick = () => {
          if (!nameInput.value.trim() || (!instagramInput.value.trim() && !phoneInput.value.trim()) || !menuSelect.value) {
            showStatus('お名前、連絡先、メニューを入力・選択してから時間を選択してください。');
            statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' }); // スマホで気づくようにエラー位置へスクロール
            return;
          }

          // 所要時間分の連続した空きがあるかチェック
          let canBook = true;
          for (let i = 0; i < duration; i++) {
            const checkHour = hour + i;
            if (checkHour > 19) {
              canBook = false;
              break;
            }
            if (getSlotStatus(date, checkHour) !== 'available') {
              canBook = false;
              break;
            }
          }

          if (!canBook) {
            showStatus(`この時間からではメニューの所要時間（${duration}時間）を確保できないため、予約できません。`);
            statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          statusMessage.style.display = 'none'; // 入力済みならエラーを消す
          document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
          
          // 所要時間分だけボタンを青く（選択状態に）する
          for (let i = 0; i < duration; i++) {
            const t = new Date(slotTime);
            t.setHours(t.getHours() + i);
            const targetBtn = document.querySelector(`.time-slot-btn[data-datetime="${t.toISOString()}"]`);
            if (targetBtn) {
              targetBtn.classList.add('selected');
            }
          }
          
          document.getElementById('selected-datetime').value = slotTime.toISOString();
          updateSummary();
        };
        td.appendChild(btn);
      }
      tr.appendChild(td);
    });
    bodyElement.appendChild(tr);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const customerName = nameInput.value;
  const instagramId = instagramInput.value;
  const phoneNumber = phoneInput.value;
  const menuId = document.getElementById('menu-select').value;
  const datetime = document.getElementById('selected-datetime').value;

  if (!instagramId.trim() && !phoneNumber.trim()) {
    showStatus('Instagram ID、または電話番号のどちらかを入力してください。');
    return;
  }

  if (!datetime) {
    showStatus('予約時間を選択してください。');
    return;
  }

  try {
    const response = await fetch('http://localhost:8000/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customerName,
        instagram_id: instagramId,
        phone_number: phoneNumber,
        menu_id: menuId,
        reservation_date: datetime
      })
    });

    if (!response.ok) throw new Error();
    
    // 予約完了画面への切り替え
    const selectedDatetimeStr = summaryDatetime.textContent; // 例: "4/30(火) 10:00 〜 11:00"
    formContainer.style.display = 'none';
    successContainer.style.display = 'block';
    successDatetimeMsg.innerHTML = selectedDatetimeStr;
    
    form.reset();
    document.getElementById('selected-datetime').value = '';
    statusMessage.style.display = 'none';
    updateSummary();
    currentStartDate = new Date(); // 予約完了後は今日の日付に戻す
    loadAndRenderSchedule(); // サーバーから最新の予約状況を再取得
  } catch {
    showStatus('送信に失敗しました。サーバーが起動しているか確認してください。');
  }
});

// ホームに戻るボタン
backToHomeBtn.addEventListener('click', () => {
  successContainer.style.display = 'none';
  formContainer.style.display = 'block';
});
