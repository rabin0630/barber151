// チュートリアル専用の管理者画面。APIは呼ばず、案内で通る操作だけを画面に反映する
import { showAdminMain, startAdminTutorial } from '../modules/adminTutorial.ts';
import { OTHER_RESERVATIONS, PRACTICE_SLOT, renderTutorialSchedule, type TutorialReservation } from '../modules/tutorialSchedule.ts';

const contactModal = document.getElementById('admin-contact-modal') as HTMLDivElement;

/** 予約画面のチュートリアルで入れた予約。名前などは見本の値と同じにする */
const PRACTICE_RESERVATION: TutorialReservation = {
  ...PRACTICE_SLOT,
  duration: 1,
  menuName: 'フルコース',
  customerName: 'test',
  instagramId: 'tim_cook',
};

(document.getElementById('admin-login-form') as HTMLFormElement).addEventListener('submit', (e: SubmitEvent) => {
  e.preventDefault();
  showAdminMain();
});

(document.getElementById('contact-close-btn') as HTMLButtonElement).addEventListener('click', () => {
  contactModal.style.display = 'none';
});

renderTutorialSchedule({
  daysToShow: window.innerWidth <= 600 ? 3 : 7,
  reservations: [...OTHER_RESERVATIONS, PRACTICE_RESERVATION],
  mergesReservation: true,
  fillReservationCell: (td, reservation) => {
    td.className = 'booked-cell';
    td.innerHTML = `
      <div class="booking-card">
        <span class="booking-card-menu">${reservation.menuName}</span>
        <span class="booking-card-name">${reservation.customerName}</span>
        <span class="booking-card-instagram">@${reservation.instagramId}</span>
      </div>
    `;
    if (reservation === PRACTICE_RESERVATION) {
      td.dataset.practice = '';
      td.addEventListener('click', () => {
        contactModal.style.display = 'flex';
      });
    }
  },
  fillEmptyCell: (td) => {
    td.textContent = '＋';
    td.className = 'holiday clickable-cell';
    td.style.color = '#2563eb';
    td.style.fontWeight = 'bold';
  },
});

startAdminTutorial();
