document.addEventListener('DOMContentLoaded', () => {
    const itemsGrid = document.getElementById('items-grid');
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const modal = document.getElementById('modal');
    const modalBody = document.querySelector('.modal-body');
    const closeModalBtn = document.querySelector('.close-button');
    const pinButton = document.getElementById('pin-button');

    // 模擬的資料，實際應從 GitHub API 獲取
    // 這裡我們需要一個方法來獲取檔案清單和元數據 (例如標籤)
    const allItems = [
        { name: "莫蘭迪色卡.jpg", path: "docs/color-palette.jpg", type: "image", tags: ["設計", "色彩"], description: "我的莫蘭迪色卡，用於專案配色。" },
        { name: "專案規劃.pdf", path: "docs/project-plan.pdf", type: "document", tags: ["專案", "文件"], description: "一個關於網頁架構的詳細規劃文件。" },
        { name: "草圖.png", path: "docs/sketch.png", type: "image", tags: ["設計", "草圖"], description: "網站首頁的初步草圖。" },
        { name: "網頁內容.md", path: "docs/content.md", type: "document", tags: ["文件", "內容"], description: "關於網站內容文字的筆記。" }
    ];

    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null;

    // 渲染所有項目卡片
    function renderItems(items) {
        itemsGrid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            // 根據文件類型顯示不同圖示
            const icon = item.type === 'image' ? '🖼️' : '📄';
            
            card.innerHTML = `
                <div class="item-header">
                    ${icon}
                    <h3>${item.name}</h3>
                </div>
                <div class="item-description">
                    <p>${item.description}</p>
                </div>
            `;
            
            card.addEventListener('click', () => showModal(item));
            itemsGrid.appendChild(card);
        });
    }

    // 渲染所有標籤
    function renderTags() {
        const allTags = [...new Set(allItems.flatMap(item => item.tags))];
        tagsContainer.innerHTML = '';
        allTags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.textContent = tag;
            tagSpan.addEventListener('click', () => filterByTag(tag));
            tagsContainer.appendChild(tagSpan);
        });
    }

    // 依標籤篩選
    function filterByTag(selectedTag) {
        const filtered = allItems.filter(item => item.tags.includes(selectedTag));
        renderItems(filtered);
    }
    
    // 依關鍵字搜尋
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) || 
            item.description.toLowerCase().includes(searchTerm) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        renderItems(filtered);
    });

    // 顯示浮動視窗
    function showModal(item) {
        currentItem = item;
        modalBody.innerHTML = ''; // 清空內容

        let content = '';
        if (item.type === 'image') {
            content = `<img src="${item.path}" alt="${item.name}" style="max-width: 100%;">`;
        } else if (item.type === 'document') {
            // 對於文件，我們需要讀取內容。這部分需要額外處理。
            // 這裡可以載入 PDF 內嵌或顯示 Markdown 內容。
            // 以 Markdown 為例，你可以使用 marked.js 來解析：
            // content = `<div class="document-content">${markdownContent}</div>`;
            // 這裡為了簡化，先顯示一個提示
            content = `<p>文件內容的完整檢視功能需額外開發。<br>這裡顯示文件路徑：${item.path}</p>`;
        }
        
        modalBody.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="modal-content-body">${content}</div>
        `;
        
        // 重新加入釘選按鈕
        const pinBtn = document.createElement('button');
        pinBtn.id = 'pin-button';
        pinBtn.className = 'pin-button';
        pinBtn.textContent = pinnedItems.some(p => p.path === item.path) ? '★ 已釘選' : '★ 釘選';
        pinBtn.addEventListener('click', togglePin);
        modalBody.appendChild(pinBtn);
        
        modal.style.display = 'block';
    }

    // 關閉浮動視窗
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        currentItem = null;
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 釘選/取消釘選功能
    function togglePin() {
        if (!currentItem) return;

        const isPinned = pinnedItems.some(p => p.path === currentItem.path);
        if (isPinned) {
            pinnedItems = pinnedItems.filter(p => p.path !== currentItem.path);
        } else {
            pinnedItems.push(currentItem);
        }

        localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
        
        // 更新按鈕狀態
        const pinBtn = document.getElementById('pin-button');
        if (pinBtn) {
            pinBtn.textContent = isPinned ? '★ 釘選' : '★ 已釘選';
        }
    }

    // 初始渲染
    renderItems(allItems);
    renderTags();
});