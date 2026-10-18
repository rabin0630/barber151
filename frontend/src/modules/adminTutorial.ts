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

/** 1. このアプリの使い方（管理者画面） */
const USAGE_STEPS: TutorialStep[] = [
  {
    selector: '#admin-login-token',
    title: '管理者画面へようこそ！',
    text: `ここからはお店側の画面だよ。ポートフォリオ用に、パスワードは「${DEMO_PASSWORD}」にしてあるよ。入れてみて！`,
    waitFor: 'input',
    fillValue: DEMO_PASSWORD,
  },
  {
    selector: '#admin-login-submit-btn',
    title: '管理者画面に入ろう',
    text: '「入る」を押してね。',
    waitFor: 'click',
    // 予約一覧を読み込み終わってから次へ進む
    nextWhen: () => (document.getElementById('admin-main') as HTMLElement).dataset.loaded === 'true',
  },
  {
    find: findPracticeReservation,
    title: 'さっきの予約を見てみよう',
    text: 'これが予約一覧だよ。さっき予約した「test」さんがここにいるよ！タップしてみて。',
    restore: closeContactModal,
    waitFor: 'click',
  },
  {
    selector: '#admin-contact-modal .modal-content',
    title: 'お客様の詳細',
    text: '名前や電話番号を押すと、書き換えたり、電話やInstagramで連絡したりできるよ。予約の取り消しやドタキャンの記録もここでできるんだ。',
    restore: openContactModal,
  },
  {
    selector: '#contact-close-btn',
    title: '一覧に戻ろう',
    text: '「閉じる」を押してね。',
    restore: openContactModal,
    waitFor: 'click',
  },
  {
    selector: '#schedule-body .clickable-cell',
    title: '電話予約の追加',
    text: '「＋」の枠を押すと、電話でもらった予約を追加できるよ。',
  },
  {
    selector: '#menu-manager-wrapper',
    title: 'メニュー管理',
    text: 'メニューの追加・変更・削除はここ。保存すると予約画面にすぐ反映されるよ。',
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
    text: '最後まで見てくれて、本当にありがとうございました！',
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
