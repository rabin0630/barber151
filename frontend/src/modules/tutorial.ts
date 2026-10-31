// チュートリアルの共通部分。光らせる枠と、案内役が話す吹き出しを出してステップを進める
// 画面ごとのステップは bookingTutorial.ts、adminTutorial.ts に書く

/** チュートリアルの1ステップである */
export type TutorialStep = {
  /** 光らせる要素のセレクタ。ない時は何も光らせず、吹き出しを画面の真ん中に出す（あいさつなど） */
  selector?: string;
  /** セレクタだけで決まらない要素を探す関数。ある時はこちらを使う */
  find?: () => HTMLElement | null;
  /** 吹き出しの見出し。ない時はセリフだけを出す */
  title?: string;
  /** セリフ。箇条書きなどのHTMLも書ける。関数にすると、表示する時にセリフを決められる */
  text: string | (() => string);
  /**
   * お客様に実際に操作してもらうステップの時に指定する
   * - 'change': 光らせた要素の中で選択したら次へ進む（ラジオボタンなど）
   * - 'click': 光らせた要素を押したら次へ進む
   * - 'input': 入力欄に fillValue（fills）と同じ値が入ったら次へ進む
   */
  waitFor?: 'change' | 'click' | 'input';
  /** 光らせた入力欄に入れてもらう値。「次へ」を押した時は、この値を自動で入れる */
  fillValue?: string;
  /** 光らせた範囲の中の、複数の入力欄に入れてもらう値。全部そろったら次へ進む */
  fills?: { selector: string; value: string }[];
  /** 操作したあと、この条件になるまで待ってから次へ進む（サーバーの返事を待つ時など） */
  nextWhen?: () => boolean;
  /** 操作された時に呼ぶ。次へ進む前に、画面側で何かしたい時に使う */
  onDone?: (target: HTMLElement) => void;
  /** 「戻る」でこのステップに戻ってきた時に、画面をこのステップの状態に戻す */
  restore?: () => void;
  /** 表示する前に呼ぶ。光らせる要素が見えるように、画面を切り替えたい時に使う（表の日付を送るなど） */
  prepare?: () => void;
  /** 前のステップに戻れないようにする（予約を送ったあとなど、やり直せない時） */
  noBack?: boolean;
};

/**
 * スキップボタンの代わりに出す、途中のステップへ飛ぶボタン
 * 例: 使い方を飛ばして「工夫したこと」へ行く「使い方を飛ばす」ボタン
 */
export type TutorialJump = {
  /** ボタンの文字 */
  label: string;
  /** index番目のステップを表示している時に、スキップの代わりにこのボタンを出すか */
  isShown: (index: number) => boolean;
  /** 押した時の処理。goTo を呼ぶと、このチュートリアルの index 番目のステップへ飛ぶ */
  onClick: (goTo: (index: number) => void) => void;
};

export type TutorialOptions = {
  /** 終わった時やスキップした時に呼ぶ */
  onEnd?: () => void;
  /** 最後のステップまで進んで終わった時だけ呼ぶ（スキップした時は呼ばない） */
  onFinish?: () => void;
  /** 何番目のステップから始めるか。省略した時は最初から */
  startIndex?: number;
  jump?: TutorialJump;
};

let steps: TutorialStep[] = [];
let options: TutorialOptions = {};
/** 「チュートリアルを終わる」を押した時の確認モーダル */
let confirmEl: HTMLDivElement | null = null;
let spotlightEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let currentIndex: number = 0;
/** 操作待ちのステップで登録したイベントを外す関数 */
let removeWaitListener: (() => void) | null = null;
/** nextWhen の条件を確かめるタイマー */
let nextWhenTimer: number | undefined;

/** nextWhen のタイマーを止める */
const stopNextWhenTimer = (): void => {
  clearInterval(nextWhenTimer);
  nextWhenTimer = undefined;
};

/**
 * 入力した値が見本と同じか比べる
 * 前後の空白、Instagramの先頭の@、電話番号のハイフンの有無は気にしない
 */
const isSameInput = (value: string, expected: string): boolean => {
  const normalize = (v: string): string => v.trim().replace(/^@/, '').replace(/[-\s]/g, '');
  return normalize(value) === normalize(expected);
};

/** 光らせる要素を探す。画面に表示されていない時（閉じているモーダルの中など）は null を返す */
const getTarget = (step: TutorialStep): HTMLElement | null => {
  const target: HTMLElement | null = step.find
    ? step.find()
    : step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
  return target && target.getClientRects().length > 0 ? target : null;
};

/** 光らせる要素がない、画面の真ん中に出すステップか */
const isCenterStep = (step: TutorialStep): boolean => !step.selector && !step.find;

/** 入力してもらう入力欄と値の組を返す（fillValue なら光らせた入力欄1つ、fills なら複数） */
const getFields = (step: TutorialStep, target: HTMLElement | null): { input: HTMLInputElement; value: string }[] => {
  if (step.fills) {
    return step.fills.flatMap(({ selector, value }) => {
      const input = document.querySelector<HTMLInputElement>(selector);
      return input ? [{ input, value }] : [];
    });
  }
  if (step.fillValue !== undefined && target instanceof HTMLInputElement) {
    return [{ input: target, value: step.fillValue }];
  }
  return [];
};

/** 入力欄がすべて見本と同じ値になっているか */
const isAllFilled = (fields: { input: HTMLInputElement; value: string }[]): boolean =>
  fields.length > 0 && fields.every(({ input, value }) => isSameInput(input.value, value));

/**
 * 操作待ちのステップが、もう操作済みか
 * 戻ってきた時は同じ操作をしても進めない（選び直しても変化がない）ので、「次へ」を出すのに使う
 */
const isStepDone = (step: TutorialStep, target: HTMLElement): boolean => {
  if (step.waitFor === 'change') return target.querySelector('input:checked') !== null;
  if (step.waitFor === 'input') return isAllFilled(getFields(step, target));
  return false;
};

/**
 * チュートリアル中は裏のボタンを押せないようにする
 * 吹き出しと、操作待ちのステップで光らせている要素だけは押せる
 */
const blockClick = (e: MouseEvent): void => {
  // プログラムからのクリック（予約を確定するボタンが送信ボタンを押す処理など）は止めない
  if (!e.isTrusted) return;
  const clicked = e.target as Node;
  if (tooltipEl?.contains(clicked) || confirmEl?.contains(clicked)) return;
  const step: TutorialStep | undefined = steps[currentIndex];
  if (step?.waitFor && getTarget(step)?.contains(clicked)) return;
  e.preventDefault();
  e.stopPropagation();
};

/** 光らせる枠と吹き出しを、対象の要素の位置に合わせる */
const updatePosition = (): void => {
  if (!spotlightEl || !tooltipEl) return;
  const step: TutorialStep = steps[currentIndex];

  if (isCenterStep(step)) {
    // 枠を画面の真ん中で大きさ0にして、画面全体を暗くする
    // 次のステップに進む時は、真ん中から対象の要素へ枠が広がって見える
    spotlightEl.classList.add('is-hidden');
    spotlightEl.style.top = `${window.innerHeight / 2}px`;
    spotlightEl.style.left = `${window.innerWidth / 2}px`;
    spotlightEl.style.width = '0px';
    spotlightEl.style.height = '0px';
    const tooltipRect: DOMRect = tooltipEl.getBoundingClientRect();
    tooltipEl.style.top = `${(window.innerHeight - tooltipRect.height) / 2}px`;
    tooltipEl.style.left = `${(window.innerWidth - tooltipRect.width) / 2}px`;
    return;
  }

  const target: HTMLElement | null = getTarget(step);
  if (!target) return;
  spotlightEl.classList.remove('is-hidden');

  const rect: DOMRect = target.getBoundingClientRect();
  const padding: number = 6;
  spotlightEl.style.top = `${rect.top - padding}px`;
  spotlightEl.style.left = `${rect.left - padding}px`;
  spotlightEl.style.width = `${rect.width + padding * 2}px`;
  spotlightEl.style.height = `${rect.height + padding * 2}px`;

  // 吹き出しは画面の下半分にある要素なら上に、上半分なら下に出す
  const tooltipRect: DOMRect = tooltipEl.getBoundingClientRect();
  const gap: number = 16;
  const isLowerHalf: boolean = rect.top + rect.height / 2 > window.innerHeight / 2;
  const top: number = isLowerHalf
    ? rect.top - padding - gap - tooltipRect.height
    : rect.bottom + padding + gap;
  // 上下左右とも画面からはみ出さないようにする。はみ出す時は対象に重なっても画面内に収める
  // （吹き出しが画面外に出ると「次へ」が押せなくなるため）
  const margin: number = 16;
  const maxTop: number = window.innerHeight - tooltipRect.height - margin;
  const maxLeft: number = window.innerWidth - tooltipRect.width - margin;
  tooltipEl.style.top = `${Math.max(Math.min(top, maxTop), margin)}px`;
  tooltipEl.style.left = `${Math.max(Math.min(rect.left, maxLeft), margin)}px`;
};

/**
 * index番目のステップを表示する
 * @param direction 進む時は1、戻る時は-1。対象がないステップを飛ばす向きに使う
 */
const showStep = (index: number, direction: 1 | -1 = 1): void => {
  if (!tooltipEl) return;
  if (index >= steps.length) {
    endTutorial();
    options.onFinish?.();
    return;
  }
  if (index < 0) {
    // 前に表示できるステップがない時は、最初から進め直す
    showStep(0, 1);
    return;
  }
  removeWaitListener?.();
  removeWaitListener = null;
  stopNextWhenTimer();
  currentIndex = index;
  const step: TutorialStep = steps[index];
  const isLast: boolean = index === steps.length - 1;
  const goNext = (): void => showStep(index + 1, 1);
  const goBack = (): void => showStep(index - 1, -1);

  // 戻ってきた時は、画面もこのステップの状態に戻す（例: 日時選択 → メニュー選択）
  if (direction === -1) step.restore?.();
  step.prepare?.();

  // 対象は画面の切り替えで作り直されることがあるので、表示する時に探す
  // メニューの取得に失敗した時や、もう閉じたモーダルの中など、対象がないステップは飛ばす
  const target: HTMLElement | null = getTarget(step);
  if (!target && !isCenterStep(step)) {
    showStep(index + direction, direction);
    return;
  }

  /** 操作されたら次へ進む。nextWhen がある時は、その条件になるまで待つ */
  const onDone = (): void => {
    if (target) step.onDone?.(target);
    const nextWhen = step.nextWhen;
    if (!nextWhen) {
      goNext();
      return;
    }
    stopNextWhenTimer();
    nextWhenTimer = window.setInterval(() => {
      if (nextWhen()) goNext();
    }, 100);
  };

  // 操作待ちのステップでは、「次へ」を押すと、その操作を自動でして進む（自分で光っている所を操作してもよい）
  // ただし戻ってきて操作済みの時は、同じ操作をしても進めないので、そのまま次へ進む
  const needsAction: boolean = !!step.waitFor && !(target !== null && isStepDone(step, target));
  // 操作できずに止まらないよう、操作待ちのステップは最後でもスキップを出す
  const canSkip: boolean = !isLast || !!step.waitFor;
  // 途中のステップへ飛ぶボタンがある時は、スキップの代わりにそれを出す
  const jump: TutorialJump | null = options.jump?.isShown(index) ? options.jump : null;
  const canBack: boolean = index > 0 && !step.noBack;
  // 上の段は左にチュートリアルを終わる、右にステップ数。真ん中は案内役のアイコンがセリフを話しているように見せる
  // 下の段は左にスキップ（使い方を飛ばす）、右に戻ると次へ
  // 「次へ」はどのステップでも同じ場所に出し、押し続けるだけで最後まで進めるようにする
  tooltipEl.innerHTML = `
    <div class="tutorial-header">
      <button type="button" class="tutorial-quit-btn">チュートリアルを終わる</button>
      <p class="tutorial-count">${index + 1} / ${steps.length}</p>
    </div>
    <div class="tutorial-talk">
      <img src="/images/tutorial-guide.png" alt="案内役" class="tutorial-guide" width="56" height="56">
      <div class="tutorial-bubble">
        ${step.title ? `<h3 class="tutorial-title">${step.title}</h3>` : ''}
        <div class="tutorial-text">${typeof step.text === 'function' ? step.text() : step.text}</div>
      </div>
    </div>
    <div class="tutorial-actions">
      ${jump
        ? `<button type="button" class="tutorial-skip-btn tutorial-jump-btn">${jump.label}</button>`
        : `<button type="button" class="tutorial-skip-btn" style="visibility: ${canSkip ? 'visible' : 'hidden'};">スキップ</button>`}
      <div class="tutorial-actions-right">
        ${canBack ? '<button type="button" class="tutorial-back-btn">戻る</button>' : ''}
        <button type="button" class="tutorial-next-btn">${isLast && !needsAction ? 'おわる' : '次へ'}</button>
      </div>
    </div>
  `;
  (tooltipEl.querySelector('.tutorial-quit-btn') as HTMLButtonElement).addEventListener('click', showQuitConfirm);
  (tooltipEl.querySelector('.tutorial-skip-btn') as HTMLButtonElement).addEventListener('click', () => {
    if (jump) {
      jump.onClick((jumpIndex: number) => showStep(jumpIndex, 1));
    } else {
      endTutorial();
    }
  });
  tooltipEl.querySelector('.tutorial-back-btn')?.addEventListener('click', goBack);
  const fields = getFields(step, target);

  /** 操作待ちのステップで「次へ」を押した時に、その操作を代わりにする */
  const doActionForUser = (): void => {
    // 予約の送信など、サーバーの返事を待っている間は、二重に送らないよう何もしない
    if (nextWhenTimer !== undefined || !target) return;
    if (step.waitFor === 'input') {
      // 手で打った時と同じようにinputイベントを起こして、ボタンの有効化なども動かす
      for (const { input, value } of fields) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (step.waitFor === 'change') {
      // メニューのカードなど、中のラジオボタンを選ぶ
      (target instanceof HTMLInputElement ? target : target.querySelector('input'))?.click();
    } else if (step.waitFor === 'click') {
      // 無効なボタンはclick()しても何も起きず止まってしまうので、操作せずに次へ進む
      if (target instanceof HTMLButtonElement && target.disabled) {
        goNext();
        return;
      }
      target.click();
    }
  };
  (tooltipEl.querySelector('.tutorial-next-btn') as HTMLButtonElement).addEventListener('click', needsAction ? doActionForUser : goNext);

  if (step.waitFor === 'input' && target && fields.length > 0) {
    // 全部の入力欄に見本と同じ値が入ったら次へ進む（inputイベントは光らせた範囲まで伝わってくる）
    const onInput = (): void => {
      if (isAllFilled(fields)) onDone();
    };
    target.addEventListener('input', onInput);
    removeWaitListener = () => target.removeEventListener('input', onInput);
  } else if (target && (step.waitFor === 'change' || step.waitFor === 'click')) {
    const eventName: 'change' | 'click' = step.waitFor;
    target.addEventListener(eventName, onDone);
    removeWaitListener = () => target.removeEventListener(eventName, onDone);
  }
  // 対象が画面外にある時はスクロールしてから位置を合わせる
  target?.scrollIntoView({ block: 'center' });
  requestAnimationFrame(updatePosition);
};

/** 「チュートリアルを本当に終了しますか？」のモーダルを出す。はいでトップページに戻り、いいえで閉じる */
function showQuitConfirm(): void {
  if (confirmEl) return;
  confirmEl = document.createElement('div');
  confirmEl.className = 'tutorial-confirm';
  confirmEl.innerHTML = `
    <div class="tutorial-confirm-content" role="alertdialog" aria-modal="true" aria-labelledby="tutorial-confirm-title">
      <p id="tutorial-confirm-title" class="tutorial-confirm-title">チュートリアルを本当に終了しますか？</p>
      <div class="tutorial-confirm-actions">
        <button type="button" class="tutorial-confirm-no-btn">いいえ</button>
        <button type="button" class="tutorial-confirm-yes-btn">はい</button>
      </div>
    </div>
  `;
  (confirmEl.querySelector('.tutorial-confirm-yes-btn') as HTMLButtonElement).addEventListener('click', () => {
    endTutorial();
    window.location.href = 'index.html';
  });
  (confirmEl.querySelector('.tutorial-confirm-no-btn') as HTMLButtonElement).addEventListener('click', hideQuitConfirm);
  document.body.append(confirmEl);
}

function hideQuitConfirm(): void {
  confirmEl?.remove();
  confirmEl = null;
}

/** チュートリアルを閉じる */
function endTutorial(): void {
  hideQuitConfirm();
  removeWaitListener?.();
  removeWaitListener = null;
  stopNextWhenTimer();
  spotlightEl?.remove();
  tooltipEl?.remove();
  spotlightEl = null;
  tooltipEl = null;
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  document.removeEventListener('click', blockClick, true);
  options.onEnd?.();
}

/**
 * チュートリアルを表示する
 * @param tutorialSteps 表示するステップ
 */
export function startTutorial(tutorialSteps: TutorialStep[], tutorialOptions: TutorialOptions = {}): void {
  if (tooltipEl) return; // 表示中なら何もしない
  steps = tutorialSteps;
  options = tutorialOptions;

  // 周りを暗くして、対象の要素だけを明るく見せる枠
  spotlightEl = document.createElement('div');
  spotlightEl.className = 'tutorial-spotlight';

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tutorial-tooltip';

  document.body.append(spotlightEl, tooltipEl);


  window.addEventListener('resize', updatePosition);
  // 予約表はPCだと表の中だけスクロールするので、キャプチャで中のスクロールも拾う
  window.addEventListener('scroll', updatePosition, true);
  // ほかのクリック処理より先に止めるため、キャプチャで受け取る
  document.addEventListener('click', blockClick, true);
  showStep(options.startIndex ?? 0);
}

/**
 * URLの ?tutorial= の値を取り出す（例: ?tutorial=1 なら '1'）。付いていない時は null
 * 再読み込みでまた始まらないように、付いていたらURLから消しておく
 */
export function takeTutorialParam(): string | null {
  const url = new URL(window.location.href);
  const value: string | null = url.searchParams.get('tutorial');
  if (value === null) return null;
  url.searchParams.delete('tutorial');
  history.replaceState(null, '', url);
  return value;
}
