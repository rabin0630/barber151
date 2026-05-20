const menu_category_cut = document.getElementById('menu-category-cut');
const menu_category_perm = document.getElementById('menu-category-perm');
const menu_category_color = document.getElementById('menu-category-color');

interface MenuInfo {
    name: string;
    price: number;
    duration: number; // in hours
    type: string;
}

// ==========================================
// 3. 定数
// ==========================================

const MENUDATA: Record<string, MenuInfo> = {
    'cut_full': { name: 'フルコース', price: 6000, duration: 1, type: 'cut' },
    'cut': { name: 'カット', price: 4000, duration: 1, type: 'cut' },
    'perm_nurepan': { name: '濡れパン', price: 9000, duration: 3, type: 'perm' },
    'perm_punch': { name: 'パンチパーマ', price: 9000, duration: 3, type: 'perm' },
    'perm_niguro': { name: 'ニグロ', price: 9000, duration: 3, type: 'perm' },
    'perm_gokudo': { name: '極道パーマ', price: 9000, duration: 3, type: 'perm' },
    'color': { name: 'カラー', price: 8000, duration: 2, type: 'color' },
};


Object.entries(MENUDATA).forEach(([menuKey, menuInfo]) => {
    let targetContainer: HTMLElement | null = null;
    if (menuInfo.type === 'cut') {
        targetContainer = menu_category_cut;
    } else if (menuInfo.type === 'perm') {
        targetContainer = menu_category_perm;
    } else if (menuInfo.type === 'color') {
        targetContainer = menu_category_color;
    }
    if (!targetContainer) return;


    // --- menucard htmlを作成 ---
    const menuCardDiv = document.createElement('label');
    menuCardDiv.className = 'menu-card';

    const menuRadioBtn = document.createElement('input');
    menuRadioBtn.type = 'radio';
    menuRadioBtn.name = 'menu';
    menuRadioBtn.value = menuKey;
    // HTMLの仕様に合わせて、1つ目の項目にrequiredを付与
    if (menuKey === 'cut_full') {
        menuRadioBtn.required = true;
    }

    const menuDetailsDiv = document.createElement('div');
    menuDetailsDiv.className = 'menu-details';

    const menuNameSpan = document.createElement('span');
    menuNameSpan.className = 'menu-name';
    menuNameSpan.textContent = menuInfo.name;

    const menuPriceSpan = document.createElement('span');
    menuPriceSpan.className = 'menu-price';
    menuPriceSpan.textContent = `${menuInfo.price.toLocaleString()}円`;

    menuDetailsDiv.appendChild(menuNameSpan);
    menuDetailsDiv.appendChild(menuPriceSpan);

    menuCardDiv.appendChild(menuRadioBtn);
    menuCardDiv.appendChild(menuDetailsDiv);

    targetContainer.appendChild(menuCardDiv);
});

