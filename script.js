document.addEventListener('DOMContentLoaded', async () => {
    const GITHUB_USERNAME = 'fuscnthu'; // <-- **請務必替換成你的 GitHub 帳號**
    const REPO_NAME = 'fuscnthu.github.io';       // <-- **請務必替換成你的儲存庫名稱**
    const METADATA_FILE = 'metadata.json'; // 儲存庫根目錄下的中介資料檔名

    const itemsGrid = document.getElementById('items-grid');
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const modal = document.getElementById('modal');
    const modalBody = document.querySelector('.modal-body');
    const closeModalBtn = document.querySelector('.close-button');
    const loadingMessage = document.getElementById('loading-message');

    let allItems = []; // 儲存所有處理過的檔案資料
    let displayedItems = []; // 儲存目前顯示在網格上的檔案
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null;

    // --- 輔助函數 ---

    // 獲取儲存庫內容 (檔案列表)
    async function fetchRepoContents() {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`GitHub API 錯誤: ${response.statusText}`);
            }
            const data = await response.json();
            // 篩選出檔案，並獲取其下載連結
            return data.filter(item => item.type === 'file')
                       .map(item => ({
                           name: item.name,
                           path: item.path,
                           download_url: item.download_url
                       }));
        } catch (error) {
            console.error('獲取儲存庫內容失敗:', error);
            loadingMessage.textContent = '載入資料失敗，請檢查儲存庫名稱或網路。';
            return [];
        }
    }

    // 獲取中介資料
    async function fetchMetadata() {
        const url = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${METADATA_FILE}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`獲取中介資料失敗: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('獲取 metadata.json 失敗:', error);
            return []; // 如果沒有 metadata.json，則返回空陣列
        }
    }

    // 初始化資料：結合 GitHub API 數據和中介資料
    async function initializeData() {
        loadingMessage.style.display = 'block';
        const repoFiles = await fetchRepoContents();
        const metadata = await fetchMetadata();

        allItems = repoFiles.map(file => {
            const meta = metadata.find(m => m.path === file.path);
            return {
                ...file,
                type: meta ? meta.type : (file.name.match(/\.(png|jpe?g|gif|webp)$/i) ? 'image' : 'document'),
                tags: meta ? meta.tags : [],
                description: meta ? meta.description : `沒有描述 - ${file.name}`
            };
        });
        loadingMessage.style.display = 'none'; // 隱藏載入訊息
        renderItems(allItems);
        renderTags();
    }

    // --- 渲染函數 ---

    // 渲染所有項目卡片
    function renderItems(items) {
        displayedItems = items; // 更新目前顯示的項目
        itemsGrid.innerHTML = ''; // 清空現有內容
        if (items.length === 0) {
            itemsGrid.innerHTML = '<p style="text-align: center; color: var(--primary-color);">沒有找到符合條件的項目。</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            // 根據文件類型顯示不同圖示
            const icon = item.type === 'image' ? '🖼️' : (item.name.endsWith('.pdf') ? '📄' : '📝'); // PDF用📄，其他文件用📝

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
            tagSpan.addEventListener('click', () => {
                // 切換標籤的活躍狀態
                tagSpan.classList.toggle('active');
                applyFilters(); // 重新應用所有篩選
            });
            tagsContainer.appendChild(tagSpan);
        });
    }

    // --- 篩選與搜尋邏輯 ---

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        const filtered = allItems.filter(item => {
            // 關鍵字搜尋
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.description.toLowerCase().includes(searchTerm) ||
                                  item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            // 標籤篩選
            const matchesTags = activeTags.length === 0 || activeTags.every(tag => item.tags.includes(tag));
            
            return matchesSearch && matchesTags;
        });
        renderItems(filtered);
    }
    
    searchInput.addEventListener('input', applyFilters); // 任何輸入都觸發篩選

    // --- 浮動視窗 (Modal) 邏輯 ---

    // 顯示浮動視窗
    async function showModal(item) {
        currentItem = item;
        modalBody.innerHTML = ''; // 清空內容

        let contentHTML = '';
        let fileContent = ''; // 儲存從 GitHub 獲取的原始檔案內容

        try {
            const response = await fetch(item.download_url);
            if (!response.ok) {
                throw new Error(`無法獲取檔案內容: ${response.statusText}`);
            }
            if (item.type === 'image') {
                // 圖片直接使用 download_url
                contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
            } else if (item.type === 'document') {
                // 文件需要讀取內容
                fileContent = await response.text();
                if (item.name.endsWith('.md')) {
                    // Markdown 文件：使用 marked.js 解析
                    contentHTML = `<div class="markdown-body">${marked.parse(fileContent)}</div>`;
                } else if (item.name.endsWith('.pdf')) {
                    // PDF 文件：使用 iframe 內嵌
                    contentHTML = `<iframe src="${item.download_url}" frameborder="0"></iframe>`;
                } else {
                    // 其他類型文件：顯示為純文本（如果可讀）
                    contentHTML = `<pre>${fileContent.substring(0, 500)}...</pre><p>僅顯示部分內容或檔案類型不支援預覽。</p>`;
                }
            } else {
                contentHTML = `<p>檔案類型 "${item.type}" 或副檔名無法預覽。</p>`;
            }
        } catch (error) {
            console.error('預覽內容載入失敗:', error);
            contentHTML = `<p style="color: red;">載入預覽內容失敗：${error.message}。</p>`;
        }
        
        modalBody.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="modal-content-body">${contentHTML}</div>
        `;
        
        // 重新加入釘選按鈕 (確保它在 modalBody 內容更新後)
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

    // --- 初始載入 ---
    initializeData();
});