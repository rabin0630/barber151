// チュートリアル専用の予約画面。APIは呼ばず、案内で通る操作だけを画面に反映する
import { startBookingTutorial } from './modules/bookingTutorial.ts';
import { OTHER_RESERVATIONS, PRACTICE_SLOT, renderTutorialSchedule } from './modules/tutorialSchedule.ts';

const form = document.getElementById('reservation-form') as HTMLFormElement;
const footerBackBtn = document.getElementById('footer-back-btn') as HTMLButtonElement;
const footerNextBtn = document.getElementById('footer-next-btn') as HTMLButtonElement;

/** 段階ごとの要素と、次へ進むボタンの文字。配列の順番が予約の段階の順番である */
const SCREENS: { contentId: string; indicatorId: string; nextLabel: string }[] = [
  { contentId: 'step-1-menu', indicatorId: 'indicator-step1', nextLabel: '日時確認へ' },
  { contentId: 'step-2-date', indicatorId: 'indicator-step2', nextLabel: '内容確認へ' },
  { contentId: 'step-3-confirm', indicatorId: 'indicator-step3', nextLabel: '予約を確定する' },
];

/** 表示している段階（SCREENS の番号） */
let currentScreen: number = 0;

/** index番目の段階を表示する */
const showScreen = (index: number): void => {
  currentScreen = index;
  SCREENS.forEach((screen, i: number) => {
    (document.getElementById(screen.contentId) as HTMLElement).classList.toggle('active', i === index);
    (document.getElementById(screen.indicatorId) as HTMLElement).classList.toggle('active', i === index);
  });
  footerNextBtn.textContent = SCREENS[index].nextLabel;
  footerBackBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
};

/** 予約完了の画面を表示する */
const showSuccess = (): void => {
  (document.getElementById('form-container') as HTMLElement).style.display = 'none';
  (document.getElementById('success-container') as HTMLElement).style.display = 'block';
  (document.getElementById('sticky-footer') as HTMLElement).style.display = 'none';
};

footerNextBtn.addEventListener('click', () => {
  if (currentScreen < SCREENS.length - 1) {
    showScreen(currentScreen + 1);
  } else {
    showSuccess();
  }
});

footerBackBtn.addEventListener('click', () => showScreen(currentScreen - 1));

form.addEventListener('submit', (e: SubmitEvent) => e.preventDefault());

renderTutorialSchedule({
  daysToShow: window.innerWidth <= 600 ? 5 : 7,
  reservations: OTHER_RESERVATIONS,
  mergesReservation: false,
  fillReservationCell: (td) => {
    td.textContent = '❌';
    td.className = 'holiday';
  },
  fillEmptyCell: (td, date, hour) => {
    const btn: HTMLButtonElement = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '○';
    btn.className = 'time-slot-btn';
    if (date === PRACTICE_SLOT.date && hour === PRACTICE_SLOT.hour) {
      btn.dataset.practice = '';
      btn.addEventListener('click', () => btn.classList.add('selected'));
    }
    td.appendChild(btn);
  },
});

startBookingTutorial();
