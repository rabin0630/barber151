// ライト/ダークの切り替えボタン。<html>のdata-themeを書き換えると、CSSの変数の組が入れ替わる
type Theme = 'light' | 'dark';

/** 今のテーマ。data-themeが無い時はCSSと同じくdarkとみなす */
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/** テーマを当てて、ボタンには逆のモード名を出す */
const applyTheme = (theme: Theme, button: HTMLElement): void => {
  document.documentElement.dataset.theme = theme;
  button.textContent = theme === 'dark' ? 'change to light mode' : 'change to dark mode';
};

/** ボタンを押したらライト/ダークを切り替えるようにする */
export function setupThemeToggle(button: HTMLElement | null): void {
  button?.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark', button);
  });
}
