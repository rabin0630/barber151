import { createMenu, deleteMenu, fetchMenus, updateMenu } from '../services/apiClient.ts';
import type { MenuCategory, MenuInfo, MenuRequest, MenuType } from '../types/index.ts';
import { MENU_CATEGORIES } from './menuCategories.ts';

const managerEl = document.getElementById('menu-manager') as HTMLDivElement;
const statusEl = document.getElementById('menu-status-message') as HTMLDivElement;
const reservationMenuSelect = document.getElementById('admin-menu-select') as HTMLSelectElement;

/** 所要時間の選択肢の上限（営業時間 8:00〜20:00 に収まる時間） */
const MAX_DURATION: number = 12;

// メニュー管理欄の上に、結果のメッセージを表示する
function showStatus(message: string, isError: boolean): void {
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  statusEl.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
  statusEl.style.color = isError ? '#991b1b' : '#166534';
}

// メニュー1件分の編集行を作る。menuを渡さなければ追加用の空の行になる
function renderMenuRow(category: MenuType, menu?: MenuInfo): HTMLFormElement {
  const form: HTMLFormElement = document.createElement('form');
  form.className = menu ? 'menu-row' : 'menu-row menu-row-new';

  const nameInput: HTMLInputElement = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'menu-row-name';
  nameInput.required = true;
  nameInput.maxLength = 50;
  nameInput.pattern = '.*\\S.*'; // 空白だけの名前は不可
  nameInput.placeholder = '新しいメニュー名';
  nameInput.setAttribute('aria-label', 'メニュー名');
  nameInput.value = menu?.name ?? '';

  const priceInput: HTMLInputElement = document.createElement('input');
  priceInput.type = 'number';
  priceInput.required = true;
  priceInput.min = '0';
  priceInput.step = '1';
  priceInput.placeholder = '料金';
  priceInput.setAttribute('aria-label', '料金（円）');
  priceInput.value = menu ? String(menu.price) : '';

  const durationSelect: HTMLSelectElement = document.createElement('select');
  durationSelect.setAttribute('aria-label', '所要時間（時間）');
  for (let hour: number = 1; hour <= MAX_DURATION; hour++) {
    durationSelect.appendChild(new Option(`${hour}時間`, String(hour)));
  }
  durationSelect.value = String(menu?.duration ?? 1);

  const priceField: HTMLSpanElement = document.createElement('span');
  priceField.className = 'menu-row-field';
  priceField.append(priceInput, '円');

  const actions: HTMLDivElement = document.createElement('div');
  actions.className = 'menu-row-actions';

  const saveBtn: HTMLButtonElement = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'menu-save-btn';
  saveBtn.textContent = menu ? '保存' : '追加';
  actions.appendChild(saveBtn);

  const buttons: HTMLButtonElement[] = [saveBtn];

  if (menu) {
    const deleteBtn: HTMLButtonElement = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'menu-delete-btn';
    deleteBtn.textContent = '削除';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`「${menu.name}」を削除しますか？\n予約画面に表示されなくなります（入っている予約はそのまま残ります）。`)) return;
      buttons.forEach((b: HTMLButtonElement) => b.disabled = true);
      try {
        await deleteMenu(menu.id);
        showStatus(`「${menu.name}」を削除しました。`, false);
        await loadMenuManager();
      } catch (e: unknown) {
        showStatus(e instanceof Error ? e.message : 'メニューの削除に失敗しました。', true);
        buttons.forEach((b: HTMLButtonElement) => b.disabled = false);
      }
    });
    actions.appendChild(deleteBtn);
    buttons.push(deleteBtn);
  }

  form.append(nameInput, priceField, durationSelect, actions);

  form.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    const body: MenuRequest = {
      category,
      name: nameInput.value.trim(),
      price: Number(priceInput.value),
      duration: Number(durationSelect.value),
    };
    buttons.forEach((b: HTMLButtonElement) => b.disabled = true);
    try {
      if (menu) {
        await updateMenu(menu.id, body);
        showStatus(`「${body.name}」を保存しました。`, false);
      } else {
        await createMenu(body);
        showStatus(`「${body.name}」を追加しました。`, false);
      }
      await loadMenuManager();
    } catch (error: unknown) {
      showStatus(error instanceof Error ? error.message : 'メニューの保存に失敗しました。', true);
      buttons.forEach((b: HTMLButtonElement) => b.disabled = false);
    }
  });

  return form;
}

// 大きい項目ごとに、登録済みのメニューの編集行と追加用の行を描画する
function renderMenuManager(menus: MenuInfo[]): void {
  managerEl.innerHTML = '';

  MENU_CATEGORIES.forEach((category: MenuCategory) => {
    const section: HTMLDivElement = document.createElement('div');
    section.className = 'menu-admin-category';

    const title: HTMLHeadingElement = document.createElement('h3');
    title.className = 'category-title';
    const icon: HTMLImageElement = document.createElement('img');
    icon.src = category.icon;
    icon.className = 'category-icon';
    icon.width = 30;
    icon.height = 30;
    title.append(icon, category.name);
    section.appendChild(title);

    menus
      .filter((menu: MenuInfo) => menu.category === category.id)
      .forEach((menu: MenuInfo) => section.appendChild(renderMenuRow(category.id, menu)));
    section.appendChild(renderMenuRow(category.id));

    managerEl.appendChild(section);
  });
}

// 電話予約モーダルのメニュー選択肢を、大きい項目ごとにまとめて作り直す
function renderReservationMenuSelect(menus: MenuInfo[]): void {
  reservationMenuSelect.innerHTML = '';
  reservationMenuSelect.appendChild(new Option('選択してください', ''));

  MENU_CATEGORIES.forEach((category: MenuCategory) => {
    const categoryMenus: MenuInfo[] = menus.filter((menu: MenuInfo) => menu.category === category.id);
    if (categoryMenus.length === 0) return;

    const group: HTMLOptGroupElement = document.createElement('optgroup');
    group.label = category.name;
    categoryMenus.forEach((menu: MenuInfo) => {
      group.appendChild(new Option(`${menu.name} (${menu.price.toLocaleString()}円 / ${menu.duration}時間)`, String(menu.id)));
    });
    reservationMenuSelect.appendChild(group);
  });
}

/** サーバーからメニューを取得し、メニュー管理欄と電話予約のメニュー選択肢を描画する */
export async function loadMenuManager(): Promise<void> {
  try {
    const menus: MenuInfo[] = await fetchMenus();
    renderMenuManager(menus);
    renderReservationMenuSelect(menus);
  } catch (e: unknown) {
    console.error('メニューの取得に失敗しました', e);
    showStatus('メニューの取得に失敗しました。', true);
  }
}
