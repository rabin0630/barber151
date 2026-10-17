// 電話番号の入力欄のチェックと整形
// ハイフン・空白・全角数字は受け付け、数字11桁になるかで判定する（バックエンドと同じルール）

/** 形式が正しくない時のメッセージ */
const PHONE_NUMBER_ERROR = '電話番号は11桁で入力してください（例: 090-1234-5678）';

/** 区切りとして取り除く文字（空白・いろいろなハイフン・長音） */
const PHONE_NUMBER_SEPARATORS = /[\s\-‐‑–—−ー－]/g;

/**
 * 全角数字を半角にし、区切りを取り除く
 * 例: "０９０－１２３４－５６７８" → "09012345678"
 */
const normalizePhoneNumber = (value: string): string =>
  value
    .replace(/[０-９]/g, (c: string): string => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(PHONE_NUMBER_SEPARATORS, '');

/** 空、または数字11桁になる時にtrueを返す（空の時は「どちらか必須」のチェックに任せる） */
const isValidPhoneNumber = (value: string): boolean =>
  value.trim() === '' || /^[0-9]{11}$/.test(normalizePhoneNumber(value));

/**
 * 電話番号の入力欄にチェックと整形を付ける
 * - 入力のたびに形式を確かめ、正しくなければ入力欄を無効にする（CSSの:user-invalidでエラーを出す）
 * - 欄から離れた時、数字11桁なら 090-1234-5678 の形に整える。11桁でない時は打ったまま残す
 */
export const setupPhoneNumberInput = (input: HTMLInputElement): void => {
  const check = (): void => {
    input.setCustomValidity(isValidPhoneNumber(input.value) ? '' : PHONE_NUMBER_ERROR);
  };

  input.addEventListener('input', check);
  input.addEventListener('blur', () => {
    const digits: string = normalizePhoneNumber(input.value);
    if (/^[0-9]{11}$/.test(digits)) {
      input.value = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
  });
  // form.reset()で空になった後もエラーが残らないようにする（resetイベントは値を戻す前に呼ばれる）
  input.form?.addEventListener('reset', () => setTimeout(check));
  check();
};
