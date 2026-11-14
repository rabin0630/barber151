// トップページのスクリプト
import { setupReflectionButton } from '../modules/reflectionModal.ts';
import { setupThemeToggle } from '../modules/themeToggle.ts';

setupReflectionButton(document.getElementById('reflection-btn'));
setupThemeToggle(document.getElementById('theme-toggle'));
