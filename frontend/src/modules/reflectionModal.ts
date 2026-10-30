// 「工夫したこと」ボタンを押した時に、今のページの上に出すモーダル
import '../reflection.css';
import { REFLECTIONS, type Reflection } from './reflections.ts';

let modalEl: HTMLDivElement | null = null;

/** モーダルを閉じる */
const closeModal = (): void => {
  modalEl?.remove();
  modalEl = null;
  document.removeEventListener('keydown', closeOnEscape);
};

/**
 * Escapeキーでモーダルを閉じる
 *
 * @param e キーボードのイベント
 */
function closeOnEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeModal();
}

/**
 * モーダルを開く
 *
 * すでに開いている時は何もしない
 */
const openModal = (): void => {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'reflection-modal';
  modalEl.innerHTML = `
    <div class="reflection-modal-content" role="dialog" aria-modal="true" aria-labelledby="reflection-modal-title">
      <h2 id="reflection-modal-title" class="reflection-modal-title">工夫したこと・これからの課題</h2>
      ${REFLECTIONS.map((reflection: Reflection) => `
        <section class="reflection-section">
          <h3>${reflection.title}</h3>
          <div class="reflection-body">${reflection.html}</div>
        </section>
      `).join('')}
      <button type="button" class="reflection-modal-close-btn">閉じる</button>
    </div>
  `;
  (modalEl.querySelector('.reflection-modal-close-btn') as HTMLButtonElement).addEventListener('click', closeModal);
  // モーダルの外側（暗いところ）を押しても閉じる
  modalEl.addEventListener('click', (e: MouseEvent) => {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener('keydown', closeOnEscape);
  document.body.append(modalEl);
  (modalEl.querySelector('.reflection-modal-close-btn') as HTMLButtonElement).focus();
};

/**
 * ボタンを押したら「工夫したこと」モーダルを開くようにする
 *
 * @param button 「工夫したこと」ボタン。nullなら何もしない
 */
export function setupReflectionButton(button: HTMLElement | null): void {
  button?.addEventListener('click', openModal);
}
