// 予約画面のチュートリアル。メニュー選択から予約完了まで、チュートリアル専用の画面で操作してもらう
import { startTutorial, type TutorialJump, type TutorialStep } from './tutorial.ts';
import { ADMIN_TUTORIAL_PARAM_REFLECTION } from './adminTutorialParams.ts';

/** 練習で選んでもらうメニューの名前 */
const PRACTICE_MENU_NAME = 'フルコース';

/**
 * 予約画面が今どの段階を表示しているか返す
 *
 * @return 1: メニュー選択, 2: 日時選択, 3: 内容確認
 */
const getScreen = (): number => {
  if (document.querySelector('#step-3-confirm.active')) return 3;
  if (document.querySelector('#step-2-date.active')) return 2;
  return 1;
};

/**
 * 予約画面の「戻る」ボタンを押して、screen の段階まで戻す関数を作る
 *
 * @param screen 戻す先の段階
 * @return 戻す関数
 */
const backToScreen = (screen: number) => (): void => {
  for (let i: number = getScreen(); i > screen; i--) {
    (document.getElementById('footer-back-btn') as HTMLButtonElement).click();
  }
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
    selector: '.menu-card[data-practice]',
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
    selector: '.time-slot-btn[data-practice]',
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
    selector: '.header-nav a[href^="tutorial-admin.html"]',
    title: '管理者画面へ移りましょう',
    text: '次は、今の予約がお店側でどう見えるかをご覧ください！上の「管理者画面」を押してください。',
    waitFor: 'click',
  },
];

/** 「使い方を飛ばす」の説明をするステップ。ここからボタンを出す */
const JUMP_SHOWN_FROM: number = 1;

/** 使い方を飛ばして、管理者画面の「工夫したこと」から始める */
const JUMP_TO_REFLECTION: TutorialJump = {
  label: '使い方を飛ばす',
  isShown: (index: number) => index >= JUMP_SHOWN_FROM,
  onClick: () => {
    window.location.href = `tutorial-admin.html?tutorial=${ADMIN_TUTORIAL_PARAM_REFLECTION}`;
  },
};

/**
 * 予約画面のチュートリアルを始める
 *
 * 終わる・スキップするとトップページに戻る
 */
export function startBookingTutorial(): void {
  startTutorial(STEPS, {
    jump: JUMP_TO_REFLECTION,
    onEnd: () => {
      window.location.href = 'index.html';
    },
  });
}
