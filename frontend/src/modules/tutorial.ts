/** チュートリアルの1ステップである */
type TutorialStep = {
  /** 光らせる要素のセレクタ */
  selector: string;
  /** セレクタだけで決まらない要素を探す関数。ある時はこちらを使う */
  find?: () => HTMLElement | null;
  title: string;
  text: string;
  /** このステップを見せる予約画面の段階（1: メニュー選択, 2: 日時選択, 3: 内容確認）。戻る時に画面を合わせる */
  screen: 1 | 2 | 3;
  /**
   * お客様に実際に操作してもらうステップの時に指定する
   * - 'change': 光らせた要素の中で選択したら次へ進む（ラジオボタンなど）
   * - 'click': 光らせた要素を押したら次へ進む
   * - 'input': 光らせた入力欄に fillValue と同じ値が入ったら次へ進む
   */
  waitFor?: 'change' | 'click' | 'input';
  /** 入力してもらう値。「自動入力」ボタンを押した時もこの値を入れる */
  fillValue?: string;
};

/** 一度見たらlocalStorageに保存して、次からは自動で出さない */
const STORAGE_KEY = 'bookingTutorialDone';

/** 練習で選んでもらうメニューの名前 */
const PRACTICE_MENU_NAME = 'フルコース';

/**
 * 入力した値が見本と同じか比べる
 * 前後の空白、Instagramの先頭の@、電話番号のハイフンの有無は気にしない
 */
const isSameInput = (value: string, expected: string): boolean => {
  const normalize = (v: string): string => v.trim().replace(/^@/, '').replace(/[-\s]/g, '');
  return normalize(value) === normalize(expected);
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
    selector: '.step-indicator',
    title: '予約は3ステップ',
    text: 'メニュー選択 → 日時選択 → 内容確認 の順に進みます。今どこにいるかはここで分かります。',
    screen: 1,
  },
  {
    selector: '#step-1-menu .menu-card',
    title: 'メニューを選ぶ',
    text: '受けたいメニューをタップして選びます。料金もここに書いてあります。',
    screen: 1,
  },
  {
    selector: '#footer-next-btn',
    title: '次へ進む',
    text: 'メニューを選ぶと押せるようになります。日時選択では空いている「○」の時間だけ選べます。',
    screen: 1,
  },
  {
    selector: '#step-1-menu .menu-card',
    find: findPracticeMenuCard,
    title: `${PRACTICE_MENU_NAME}を選んでみよう`,
    text: `実際に「${PRACTICE_MENU_NAME}」をタップして選んでください。`,
    screen: 1,
    waitFor: 'change',
  },
  {
    selector: '#footer-next-btn',
    title: '日時選択へ進もう',
    text: '「日時確認へ」を押すと、日時を選ぶ画面に進みます。',
    screen: 1,
    waitFor: 'click',
  },
  {
    selector: '.time-slot-btn',
    find: findEarliestSlot,
    title: '一番早い日時を選んでみよう',
    text: '「○」は空いている時間、「❌」は予約済み、「-」は予約できない時間です。光っている一番早い「○」をタップしてください。',
    screen: 2,
    waitFor: 'click',
  },
  {
    selector: '#footer-next-btn',
    title: '内容確認へ進もう',
    text: '「内容確認へ」を押すと、選んだ内容の確認と、お名前・連絡先の入力に進みます。',
    screen: 2,
    waitFor: 'click',
  },
  {
    selector: '#customer-name',
    title: 'お名前を入力しよう',
    text: 'お名前に「test」と入力してください。めんどうな時は「自動入力」を押してください。',
    screen: 3,
    waitFor: 'input',
    fillValue: 'test',
  },
  {
    selector: '#customer-instagram',
    title: 'Instagram IDを入力しよう',
    text: 'Instagram IDに「@tim_cook」と入力してください。',
    screen: 3,
    waitFor: 'input',
    fillValue: '@tim_cook',
  },
  {
    selector: '#customer-phone',
    title: '電話番号を入力しよう',
    text: '電話番号に「090-0000-0000」と入力してください。Instagram IDと電話番号は、どちらか1つ入っていれば予約できます。',
    screen: 3,
    waitFor: 'input',
    fillValue: '090-0000-0000',
  },
  {
    selector: '#footer-next-btn',
    title: '予約を確定しよう',
    text: '最後に「予約を確定する」を押すと予約が完了します。',
    screen: 3,
    waitFor: 'click',
  },
];

let spotlightEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let currentIndex: number = 0;
/** 操作待ちのステップで登録したイベントを外す関数 */
let removeWaitListener: (() => void) | null = null;

const getTarget = (step: TutorialStep): HTMLElement | null =>
  step.find ? step.find() : document.querySelector<HTMLElement>(step.selector);

/** 予約画面が今どの段階を表示しているか */
const getScreen = (): number => {
  if (document.querySelector('#step-3-confirm.active')) return 3;
  if (document.querySelector('#step-2-date.active')) return 2;
  return 1;
};

/**
 * 操作待ちのステップが、もう操作済みか
 * 戻ってきた時は同じ操作をしても進めない（選び直しても変化がない）ので、「次へ」を出すのに使う
 */
const isStepDone = (step: TutorialStep, target: HTMLElement): boolean => {
  if (step.waitFor === 'change') return target.querySelector('input:checked') !== null;
  if (step.waitFor === 'input' && step.fillValue !== undefined && target instanceof HTMLInputElement) {
    return isSameInput(target.value, step.fillValue);
  }
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
  if (tooltipEl?.contains(clicked)) return;
  const step: TutorialStep | undefined = STEPS[currentIndex];
  if (step?.waitFor && getTarget(step)?.contains(clicked)) return;
  e.preventDefault();
  e.stopPropagation();
};

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

/** 光らせる枠と吹き出しを、対象の要素の位置に合わせる */
const updatePosition = (): void => {
  if (!spotlightEl || !tooltipEl) return;
  const target: HTMLElement | null = getTarget(STEPS[currentIndex]);
  if (!target) return;

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
  // 左右は画面からはみ出さないようにする
  const maxLeft: number = window.innerWidth - tooltipRect.width - 16;
  const left: number = Math.min(Math.max(rect.left, 16), maxLeft);

  tooltipEl.style.top = `${Math.max(top, 16)}px`;
  tooltipEl.style.left = `${left}px`;
};

/**
 * index番目のステップを表示する
 * @param direction 進む時は1、戻る時は-1。対象がないステップを飛ばす向きに使う
 */
const showStep = (index: number, direction: 1 | -1 = 1): void => {
  if (!tooltipEl) return;
  if (index >= STEPS.length) {
    endTutorial();
    return;
  }
  if (index < 0) {
    // 前に表示できるステップがない時は、最初から進め直す
    showStep(0, 1);
    return;
  }
  removeWaitListener?.();
  removeWaitListener = null;
  currentIndex = index;
  const step: TutorialStep = STEPS[index];
  const isLast: boolean = index === STEPS.length - 1;
  const goNext = (): void => showStep(index + 1, 1);
  const goBack = (): void => showStep(index - 1, -1);

  // 戻る時は、予約画面もそのステップの段階まで戻す（例: 日時選択 → メニュー選択）
  if (direction === -1) {
    for (let i: number = getScreen(); i > step.screen; i--) {
      (document.getElementById('footer-back-btn') as HTMLButtonElement).click();
    }
  }

  // 対象は画面の切り替えで作り直されることがあるので、表示する時に探す
  // メニューの取得に失敗した時など、対象がないステップは飛ばす
  const target: HTMLElement | null = getTarget(step);
  if (!target) {
    showStep(index + direction, direction);
    return;
  }

  // 操作待ちのステップでは「次へ」ボタンを出さず、実際の操作で進ませる
  // ただし戻ってきて操作済みの時は、同じ操作では進めないので「次へ」を出す
  const showNext: boolean = !step.waitFor || isStepDone(step, target);
  // 操作できずに止まらないよう、操作待ちのステップは最後でもスキップを出す
  const canSkip: boolean = !isLast || !!step.waitFor;
  // 上の段は左に戻る、右にステップ数。下の段は左に自動入力、右にスキップと次へ
  tooltipEl.innerHTML = `
    <div class="tutorial-header">
      <button type="button" class="tutorial-back-btn" style="visibility: ${index > 0 ? 'visible' : 'hidden'};">戻る</button>
      <p class="tutorial-count">${index + 1} / ${STEPS.length}</p>
    </div>
    <h3 class="tutorial-title">${step.title}</h3>
    <p class="tutorial-text">${step.text}</p>
    <div class="tutorial-actions">
      ${step.fillValue ? '<button type="button" class="tutorial-autofill-btn">自動入力</button>' : ''}
      <button type="button" class="tutorial-skip-btn" style="visibility: ${canSkip ? 'visible' : 'hidden'};">スキップ</button>
      ${showNext ? `<button type="button" class="tutorial-next-btn">${isLast ? 'はじめる' : '次へ'}</button>` : ''}
    </div>
  `;
  (tooltipEl.querySelector('.tutorial-skip-btn') as HTMLButtonElement).addEventListener('click', endTutorial);
  (tooltipEl.querySelector('.tutorial-back-btn') as HTMLButtonElement).addEventListener('click', goBack);
  tooltipEl.querySelector('.tutorial-next-btn')?.addEventListener('click', goNext);

  const fillValue: string | undefined = step.fillValue;
  if (step.waitFor === 'input' && fillValue !== undefined && target instanceof HTMLInputElement) {
    // 見本と同じ値が入ったら次へ進む
    const onInput = (): void => {
      if (isSameInput(target.value, fillValue)) goNext();
    };
    target.addEventListener('input', onInput);
    removeWaitListener = () => target.removeEventListener('input', onInput);
    // 自動入力は、手で打った時と同じようにinputイベントを起こして、ボタンの有効化なども動かす
    tooltipEl.querySelector('.tutorial-autofill-btn')?.addEventListener('click', () => {
      target.value = fillValue;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  } else if (step.waitFor === 'change' || step.waitFor === 'click') {
    const eventName: 'change' | 'click' = step.waitFor;
    target.addEventListener(eventName, goNext);
    removeWaitListener = () => target.removeEventListener(eventName, goNext);
  }
  // 対象が画面外にある時はスクロールしてから位置を合わせる
  target.scrollIntoView({ block: 'center' });
  requestAnimationFrame(updatePosition);
};

/** チュートリアルを閉じて、見た記録を残す */
function endTutorial(): void {
  removeWaitListener?.();
  removeWaitListener = null;
  spotlightEl?.remove();
  tooltipEl?.remove();
  spotlightEl = null;
  tooltipEl = null;
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  document.removeEventListener('click', blockClick, true);
  markDone();
}

/** チュートリアルを最初から表示する */
function startTutorial(): void {
  if (tooltipEl) return; // 表示中なら何もしない

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
  showStep(0);
}

/**
 * 予約画面を開いた時にチュートリアルを表示するか決める
 * トップのTUTORIALボタン（?tutorial=1）から来た時と、初めて開いた時に表示する
 */
export function startTutorialOnLoad(): void {
  const url = new URL(window.location.href);
  const isRequested: boolean = url.searchParams.has('tutorial');
  if (isRequested) {
    // 再読み込みでまた始まらないように、URLから消しておく
    url.searchParams.delete('tutorial');
    history.replaceState(null, '', url);
  }
  if (isRequested || !isDone()) {
    startTutorial();
  }
}
