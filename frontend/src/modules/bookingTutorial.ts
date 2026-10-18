// 予約画面のチュートリアル。メニュー選択から予約完了まで、実際に操作してもらう
import { startTutorial, takeTutorialParam, type TutorialJump, type TutorialStep } from './tutorial.ts';
import { ADMIN_TUTORIAL_PARAM_REFLECTION, ADMIN_TUTORIAL_PARAM_USAGE } from './adminTutorialParams.ts';

/** 一度見たらlocalStorageに保存して、次からは自動で出さない */
const STORAGE_KEY = 'bookingTutorialDone';

/** 練習で選んでもらうメニューの名前 */
const PRACTICE_MENU_NAME = 'フルコース';

/** 見た記録があるか。localStorageが使えない時は見ていない扱いにする */
const isDone = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const markDone = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // 保存できなくてもチュートリアルは閉じられるので何もしない
  }
};

/** 予約画面が今どの段階を表示しているか（1: メニュー選択, 2: 日時選択, 3: 内容確認） */
const getScreen = (): number => {
  if (document.querySelector('#step-3-confirm.active')) return 3;
  if (document.querySelector('#step-2-date.active')) return 2;
  return 1;
};

/** 予約画面の「戻る」ボタンを押して、screen の段階まで戻す関数を作る */
const backToScreen = (screen: number) => (): void => {
  for (let i: number = getScreen(); i > screen; i--) {
    (document.getElementById('footer-back-btn') as HTMLButtonElement).click();
  }
};

/** 練習用メニューのカードを探す */
const findPracticeMenuCard = (): HTMLElement | null => {
  const cards = document.querySelectorAll<HTMLLabelElement>('#step-1-menu .menu-card');
  for (const card of cards) {
    if (card.querySelector('.menu-name')?.textContent === PRACTICE_MENU_NAME) {
      return card;
    }
  }
  return null;
};

/**
 * 一番早く予約できる「○」のボタンを探す
 * 表は時間ごとの行で並んでいるので、画面の順番ではなく日時で比べる
 */
const findEarliestSlot = (): HTMLElement | null => {
  const slots = document.querySelectorAll<HTMLButtonElement>('#step-2-date.active .time-slot-btn');
  let earliest: HTMLButtonElement | null = null;
  for (const slot of slots) {
    if (!earliest || (slot.dataset.datetime ?? '') < (earliest.dataset.datetime ?? '')) {
      earliest = slot;
    }
  }
  return earliest;
};

const STEPS: TutorialStep[] = [
  {
    title: 'はじめまして！',
    text: 'ポートフォリオをご覧いただき、ありがとうございます。ソトと申します。これから、このサイトの使い方をご案内します！',
    restore: backToScreen(1),
  },
  {
    text: `このチュートリアルでわかることは2つです。
      <ol class="tutorial-goals">
        <li><strong>このアプリの使い方</strong><span class="tutorial-goal-time">約2分</span></li>
        <li><strong>アプリで工夫したこと、これからの課題</strong><span class="tutorial-goal-time">約1分</span></li>
      </ol>
      2だけ知りたい場合は、「使い方を飛ばす」を押してください！`,
    restore: backToScreen(1),
  },
  {
    selector: '.step-indicator',
    title: '予約は3ステップ',
    text: '予約は「メニュー選択 → 日時選択 → 内容確認」の3ステップです。',
    restore: backToScreen(1),
  },
  {
    find: findPracticeMenuCard,
    title: 'メニューを選んでください',
    text: `まずはメニューから。「${PRACTICE_MENU_NAME}」をタップしてみてください！`,
    restore: backToScreen(1),
    waitFor: 'change',
  },
  {
    selector: '#footer-next-btn',
    title: '日時選択へ進みましょう',
    text: 'ありがとうございます！「日時確認へ」を押して進んでください。',
    restore: backToScreen(1),
    waitFor: 'click',
  },
  {
    find: findEarliestSlot,
    title: '日時を選んでください',
    text: '「○」が空いている時間です。光っている一番早い「○」をタップしてみてください！',
    restore: backToScreen(2),
    waitFor: 'click',
  },
  {
    selector: '#footer-next-btn',
    title: '内容確認へ進みましょう',
    text: 'ばっちりです！「内容確認へ」を押してください。',
    restore: backToScreen(2),
    waitFor: 'click',
  },
  {
    selector: '#step-3-confirm',
    title: 'お名前と連絡先を入れてください',
    text: 'ご自身で入力していただいても、「次へ」を押してまとめて自動入力していただいても大丈夫です！Instagram IDと電話番号は、どちらか1つあれば予約できます。',
    waitFor: 'input',
    fills: [
      { selector: '#customer-name', value: 'test' },
      { selector: '#customer-instagram', value: '@tim_cook' },
      { selector: '#customer-phone', value: '090-0000-0000' },
    ],
  },
  {
    selector: '#footer-next-btn',
    title: '予約を確定しましょう',
    text: '最後に「予約を確定する」を押してみてください！',
    waitFor: 'click',
    // 予約の送信が終わって完了画面が出てから次へ進む。失敗した時はこのステップのまま押し直せる
    nextWhen: () => (document.getElementById('success-container') as HTMLElement).style.display !== 'none',
  },
  {
    selector: '#success-container',
    title: '予約完了！',
    text: 'これで予約完了です！お疲れさまでした！',
    noBack: true,
  },
  {
    selector: '.header-nav a[href="admin.html"]',
    title: '管理者画面へ移りましょう',
    text: '次は、今の予約がお店側でどう見えるかをご覧ください！上の「管理者画面」を押してください。',
    waitFor: 'click',
    // 管理者画面でもチュートリアルの続きを始めるよう、移動する前にリンク先に目印を付ける
    onDone: (target: HTMLElement) => {
      (target as HTMLAnchorElement).href = `admin.html?tutorial=${ADMIN_TUTORIAL_PARAM_USAGE}`;
    },
  },
];

/** 「使い方を飛ばす」の説明をするステップ。ここからボタンを出す */
const JUMP_SHOWN_FROM: number = 1;

/** 使い方を飛ばして、管理者画面の「工夫したこと」から始める */
const JUMP_TO_REFLECTION: TutorialJump = {
  label: '使い方を飛ばす',
  isShown: (index: number) => index >= JUMP_SHOWN_FROM,
  onClick: () => {
    window.location.href = `admin.html?tutorial=${ADMIN_TUTORIAL_PARAM_REFLECTION}`;
  },
};

/**
 * 予約画面を開いた時にチュートリアルを表示するか決める
 * トップの「このアプリの使い方」（?tutorial=1）から来た時と、初めて開いた時に表示する
 */
export function startBookingTutorialOnLoad(): void {
  const isRequested: boolean = takeTutorialParam() !== null;
  if (isRequested || !isDone()) {
    startTutorial(STEPS, { onEnd: markDone, jump: JUMP_TO_REFLECTION });
  }
}
