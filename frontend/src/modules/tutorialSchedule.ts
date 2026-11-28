// チュートリアル専用の画面の日程表。日付も予約もすべてハードコードする

/** 表の1日分である */
type TutorialDay = {
  date: number;
  dayOfWeek: string;
  /** 定休日か（月曜・火曜） */
  isClosed: boolean;
};

/** 表の予約1件である */
export type TutorialReservation = {
  /** 予約の入っている日 */
  date: number;
  hour: number;
  duration: number;
  menuName: string;
  customerName: string;
  instagramId: string;
};

const DAYS: TutorialDay[] = [
  { date: 5, dayOfWeek: '土', isClosed: false },
  { date: 6, dayOfWeek: '日', isClosed: false },
  { date: 7, dayOfWeek: '月', isClosed: true },
  { date: 8, dayOfWeek: '火', isClosed: true },
  { date: 9, dayOfWeek: '水', isClosed: false },
  { date: 10, dayOfWeek: '木', isClosed: false },
  { date: 11, dayOfWeek: '金', isClosed: false },
];

/** ほかのお客様の予約。予約画面では❌、管理者画面ではカードになる */
export const OTHER_RESERVATIONS: TutorialReservation[] = [
  { date: 5, hour: 8, duration: 1, menuName: 'カット', customerName: '山田 太郎', instagramId: 'yamada_taro' },
  { date: 5, hour: 13, duration: 3, menuName: 'パンチパーマ', customerName: '佐藤 花子', instagramId: 'sato_hanako' },
  { date: 6, hour: 10, duration: 2, menuName: 'カラー', customerName: '高橋 健太', instagramId: 'takahashi_kenta' },
];

/** 練習で入れてもらう予約の日時。この枠を光らせる */
export const PRACTICE_SLOT = { date: 5, hour: 9 };

type ScheduleOptions = {
  /** 表示する日数 */
  daysToShow: number;
  reservations: TutorialReservation[];
  /** 予約を1つのセルにまとめるか（管理者画面）、1時間ずつのセルにするか（予約画面） */
  mergesReservation: boolean;
  /** 予約のセルの中身を作る */
  fillReservationCell: (td: HTMLTableCellElement, reservation: TutorialReservation) => void;
  /** 空いている枠のセルの中身を作る */
  fillEmptyCell: (td: HTMLTableCellElement, date: number, hour: number) => void;
};

/**
 * 日付の見出しと、8:00から19:00までの表を描く
 *
 * @param options 表の描き方の設定
 */
export function renderTutorialSchedule(options: ScheduleOptions): void {
  const days: TutorialDay[] = DAYS.slice(0, options.daysToShow);

  (document.getElementById('schedule-header-month') as HTMLTableRowElement).innerHTML = `
    <th rowspan="2">日時</th>
    <th class="th-year-month" colspan="${days.length}">2026年12月</th>
  `;
  (document.getElementById('schedule-header') as HTMLTableRowElement).innerHTML = days.map((day: TutorialDay) => `
    <th class="${day.isClosed ? 'holiday-text' : ''}">
      <div class="th-date-num">${day.date}</div><div class="th-day-of-week">${day.dayOfWeek}</div>
    </th>
  `).join('');

  const body = document.getElementById('schedule-body') as HTMLTableSectionElement;
  for (let hour: number = 8; hour <= 19; hour++) {
    const tr: HTMLTableRowElement = document.createElement('tr');
    const timeTd: HTMLTableCellElement = document.createElement('td');
    timeTd.textContent = `${hour}:00`;
    tr.appendChild(timeTd);

    days.forEach((day: TutorialDay) => {
      const reservation: TutorialReservation | undefined = options.reservations.find((r: TutorialReservation) =>
        r.date === day.date && r.hour <= hour && hour < r.hour + r.duration);
      // まとめた予約の2時間目からは、上のセルが結合されているのでセルを作らない
      if (reservation && options.mergesReservation && reservation.hour !== hour) return;

      const td: HTMLTableCellElement = document.createElement('td');
      if (reservation) {
        options.fillReservationCell(td, reservation);
        if (options.mergesReservation) td.rowSpan = reservation.duration;
      } else if (day.isClosed) {
        td.textContent = '-';
        td.className = 'holiday';
      } else {
        options.fillEmptyCell(td, day.date, hour);
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}
