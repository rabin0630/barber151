// 管理者画面のチュートリアル。予約画面のチュートリアルの続きとして、お店側の使い方を案内する
import { startTutorial, takeTutorialParam, type TutorialJump, type TutorialStep } from './tutorial.ts';
import { ADMIN_TUTORIAL_PARAM_REFLECTION } from './adminTutorialParams.ts';
import { REFLECTIONS, type Reflection } from './reflections.ts';

/** 予約画面のチュートリアルで入れてもらったお客様の名前 */
const PRACTICE_CUSTOMER_NAME = 'test';

/** パスワード。ポートフォリオ用なので公開している */
const DEMO_PASSWORD = 'test';

const isVisible = (id: string): boolean =>
  (document.getElementById(id) as HTMLElement).style.display !== 'none';

/**
 * 予約画面のチュートリアルで入れた予約のセルを探す
 * 見つからない時（チュートリアルの途中から来た時など）は、表の一番上にある予約にする
 */
const findPracticeReservation = (): HTMLElement | null => {
  const cards = document.querySelectorAll<HTMLElement>('#schedule-body .booking-card');
  for (const card of cards) {
    if (card.querySelector('.booking-card-name')?.textContent === PRACTICE_CUSTOMER_NAME) {
      return card.closest('td');
    }
  }
  return cards[0]?.closest('td') ?? null;
};

/** 表を何回「→」で送ったか。探す時に、最初の日付から探し直すのに使う */
let pagesMoved: number = 0;

/** 表を送って探す回数。予約は2か月先まで入れられるので、スマートフォンの3日ずつでも届く回数にする */
const MAX_PAGES: number = 21;

const clickScheduleBtn = (selector: string): void =>
  (document.querySelector(selector) as HTMLButtonElement).click();

/**
 * 表示中の日付に find の要素がなければ、最初の日付から「→」で送って探す
 * 見つからない時は最初の日付に戻す。表の描き直しはすぐ終わるので、送るたびに探せる
 */
const showPageWith = (find: () => Element | null): boolean => {
  if (find()) return true;
  for (; pagesMoved > 0; pagesMoved--) clickScheduleBtn('.prev-schedule-btn');
  if (find()) return true;
  while (pagesMoved < MAX_PAGES) {
    clickScheduleBtn('.next-schedule-btn');
    pagesMoved++;
    if (find()) return true;
  }
  for (; pagesMoved > 0; pagesMoved--) clickScheduleBtn('.prev-schedule-btn');
  return false;
};

/** 練習用の予約が見える日付まで表を送る。ない時は、どれかの予約が見える日付にする */
const showPracticeReservation = (): void => {
  const findByName = (): Element | null =>
    [...document.querySelectorAll('#schedule-body .booking-card-name')]
      .find((name) => name.textContent === PRACTICE_CUSTOMER_NAME) ?? null;
  if (!showPageWith(findByName)) showPageWith(() => document.querySelector('#schedule-body .booking-card'));
};

/** 「＋」の空いている枠が見える日付まで表を送る（定休日が続く時など） */
const showEmptySlot = (): void => {
  showPageWith(() => document.querySelector('#schedule-body .clickable-cell'));
};

/** 連絡先モーダルが開いていたら閉じる */
const closeContactModal = (): void => {
  if (isVisible('admin-contact-modal')) {
    (document.getElementById('contact-close-btn') as HTMLButtonElement).click();
  }
};

/** 連絡先モーダルが閉じていたら、練習用の予約を押して開く */
const openContactModal = (): void => {
  if (!isVisible('admin-contact-modal')) {
    findPracticeReservation()?.click();
  }
};

/** 予約詳細モーダルの、idの値が入っている行（名前・電話番号など）を探す */
const findContactRow = (id: string) => (): HTMLElement | null =>
  document.getElementById(id)?.closest<HTMLElement>('.contact-row') ?? null;

/** 1. このアプリの使い方（管理者画面） */
const USAGE_STEPS: TutorialStep[] = [
  {
    selector: '#admin-login-token',
    title: '管理者画面へようこそ！',
    text: `ここからはお店側の画面です。ポートフォリオ用に、パスワードは「${DEMO_PASSWORD}」にしてあります。入力してみてください！`,
    waitFor: 'input',
    fillValue: DEMO_PASSWORD,
  },
  {
    selector: '#admin-login-submit-btn',
    title: '管理者画面に入りましょう',
    text: '「入る」を押してください。',
    waitFor: 'click',
    // 予約一覧を読み込み終わってから次へ進む
    nextWhen: () => (document.getElementById('admin-main') as HTMLElement).dataset.loaded === 'true',
  },
  // 予約一覧の表の使い方
  {
    selector: '#schedule-wrapper',
    title: '予約一覧の見方',
    text: '予約一覧の表です。横に日付、縦に8:00〜19:00の時間が並んでいます。赤い日付は定休日（月曜・火曜）です。',
  },
  {
    selector: '.schedule-nav',
    title: '日付の切り替え',
    text: '「←」「→」で、前後の日付に切り替えられます（スマートフォンは3日ずつ、PCは7日ずつです）。真ん中のカレンダーから、見たい日へ直接移動することもできます。',
  },
  {
    find: findPracticeReservation,
    title: '予約のカード',
    text: '予約はカードで表示しています。メニュー・お名前・Instagramが一目で分かり、カードの長さが施術にかかる時間です。',
    prepare: showPracticeReservation,
  },
  {
    selector: '#schedule-body .clickable-cell',
    title: '空いている枠',
    text: '「＋」は空いている枠です。押すと、電話で受けた予約を追加できます。「-」は定休日や過ぎた時間なので、予約を入れられません。',
    prepare: showEmptySlot,
  },
  {
    find: findPracticeReservation,
    title: '先ほどの予約を見てみましょう',
    text: '先ほど予約した「test」さんがここにいます！タップしてみてください。',
    restore: closeContactModal,
    prepare: showPracticeReservation,
    waitFor: 'click',
  },
  // 予約詳細のモーダルの使い方
  {
    selector: '#admin-contact-modal .modal-content',
    title: '予約の詳細',
    text: '予約の詳細です。お客様の情報の確認・書き換えや、連絡、予約の取り消しをここで行います。',
    restore: openContactModal,
  },
  {
    find: findContactRow('contact-name'),
    title: 'お名前',
    text: 'お名前を押すと、書き換えられます。',
    restore: openContactModal,
  },
  {
    find: findContactRow('contact-datetime'),
    title: '予約日時',
    text: '予約の日にちと、始まり〜終わりの時間です。',
    restore: openContactModal,
  },
  {
    find: findContactRow('contact-menu-select'),
    title: 'メニューの変更',
    text: '当日にメニューが変わった時は、ここで選び直すとすぐに変更されます。時間が延びて次の予約と重なる時は、変更できないようにしています。',
    restore: openContactModal,
  },
  {
    find: findContactRow('contact-phone'),
    title: '電話番号',
    text: '電話番号を押すと、書き換えたり、そのまま電話をかけたりできます。未登録の時は、ここから追加できます。',
    restore: openContactModal,
  },
  {
    find: findContactRow('contact-instagram'),
    title: 'Instagram',
    text: 'Instagramを押すと、書き換えたり、お客様のプロフィールを開いてDMで連絡したりできます。',
    restore: openContactModal,
  },
  {
    selector: '#admin-contact-modal .contact-actions',
    title: '予約の取り消し',
    text: '「予約を取り消す」を押すと、確認のあとで予約を削除します。「ドタキャンされた」は、ドタキャンの回数を記録するためのボタンで、現在準備中です。',
    restore: openContactModal,
  },
  {
    selector: '#contact-close-btn',
    title: '一覧に戻りましょう',
    text: '「閉じる」を押してください。',
    restore: openContactModal,
    waitFor: 'click',
  },
  {
    selector: '#history-wrapper',
    title: '最近の予約追加履歴',
    text: '新しく入った予約を、新しい順に表示しています。どの予約が増えたかをすぐに確認できます。',
  },
  {
    selector: '#menu-manager-wrapper',
    title: 'メニュー管理',
    text: 'メニューの追加・変更・削除はここで行います。保存すると予約画面にすぐ反映されます。',
  },
];

/** 「使い方を飛ばす」を押して来たか。工夫したことの前置きのセリフを変える */
let isUsageSkipped: boolean = false;

/** 2. アプリで工夫したこと、これからの課題 */
const REFLECTION_STEPS: TutorialStep[] = [
  {
    text: () => isUsageSkipped
      ? 'ここからは、このアプリで工夫したことと、これからの課題を話させてください。使い方は、トップの「このアプリの使い方」からいつでも見られます！'
      : '使い方はここまでです！最後に、このアプリで工夫したことと、これからの課題を話させてください。',
  },
  ...REFLECTIONS.map((reflection: Reflection): TutorialStep => ({ title: reflection.title, text: reflection.html })),
  {
    title: 'ありがとうございました！',
    text: '最後までご覧いただき、本当にありがとうございました！',
  },
];

const STEPS: TutorialStep[] = [...USAGE_STEPS, ...REFLECTION_STEPS];

/** 工夫したこと・これからの課題の最初のステップが何番目か */
const REFLECTION_START: number = USAGE_STEPS.length;

/** 使い方の途中で押すと、工夫したこと・これからの課題へ飛ぶ。そこから先は出さない */
const JUMP_TO_REFLECTION: TutorialJump = {
  label: '使い方を飛ばす',
  isShown: (index: number) => index < REFLECTION_START,
  onClick: (goTo: (index: number) => void) => {
    isUsageSkipped = true;
    closeContactModal();
    goTo(REFLECTION_START);
  },
};

/**
 * 予約画面のチュートリアルから来た時に、続きを始める
 * - ?tutorial=1: 使い方の続きから
 * - ?tutorial=2: 「使い方を飛ばす」を押して来た時。工夫したこと・これからの課題から
 */
export function startAdminTutorialOnLoad(): void {
  const param: string | null = takeTutorialParam();
  if (param === null) return;
  isUsageSkipped = param === ADMIN_TUTORIAL_PARAM_REFLECTION;
  startTutorial(STEPS, {
    startIndex: param === ADMIN_TUTORIAL_PARAM_REFLECTION ? REFLECTION_START : 0,
    jump: JUMP_TO_REFLECTION,
    // 最後の「おわる」を押したらトップページに戻る
    onFinish: () => {
      window.location.href = 'index.html';
    },
  });
}
