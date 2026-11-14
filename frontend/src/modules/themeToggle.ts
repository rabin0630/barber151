// ライト/ダークの切り替えボタン。<html>のdata-themeを書き換えると、CSSの変数の組が入れ替わる
type Theme = 'light' | 'dark';

/** 選んだテーマをlocalStorageに保存する時のキー */
const STORAGE_KEY = 'theme';

/** 今のテーマ。data-themeが無い時はCSSと同じくdarkとみなす */
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/** 保存してあるテーマ。保存が無い・読めない時はdark */
const loadTheme = (): Theme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // プライベートモードなどでlocalStorageが使えない時は、初期値のdarkにする
    return 'dark';
  }
};

/** 選んだテーマを保存する。保存できなくても切り替え自体はできるので、失敗は無視する */
const saveTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 保存できない時は、次に開いた時にdarkに戻るだけ
  }
};

/** テーマを当てて、ボタンには逆のモード名を出す */
const applyTheme = (theme: Theme, button: HTMLElement): void => {
  document.documentElement.dataset.theme = theme;
  button.textContent = theme === 'dark' ? 'change to light mode' : 'change to dark mode';
};

/** 保存してあるテーマを当て、ボタンを押したらライト/ダークを切り替えて保存するようにする */
export function setupThemeToggle(button: HTMLElement | null): void {
  if (!button) return;
  applyTheme(loadTheme(), button);
  button.addEventListener('click', () => {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    saveTheme(next);
  });
}
