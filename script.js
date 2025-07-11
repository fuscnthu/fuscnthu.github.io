document.addEventListener('DOMContentLoaded', async () => {
    // --- 請務必替換成你的 GitHub 帳號和儲存庫名稱 ---
    const GITHUB_USERNAME = 'fuscnthu'; // 你的 GitHub 使用者名稱
    const REPO_NAME = 'fuscnthu.github.io'; // 你的儲存庫名稱
    // --- 以上 ---

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

    // 獲取中介資料並處理成我們的 allItems 格式
    async function initializeData() {
        loadingMessage.style.display = 'block'; // 顯示載入訊息

        const metadataUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${METADATA_FILE}`;
        
        try {
            const response = await fetch(metadataUrl);
            if (!response.ok) {
                // 如果 metadata.json 不存在或無法訪問，則拋出錯誤
                throw new Error(`無法獲取 ${METADATA_FILE}: ${response.statusText}`);
            }
            const metadata = await response.json();

            // 將 metadata 轉換為我們需要的 allItems 格式，並生成 download_url
            allItems = metadata.map(metaItem => {
                const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${metaItem.path}`;
                return {
                    name: metaItem.path.split('/').pop(), // 從路徑中提取檔案名
                    path: metaItem.path,
                    type: metaItem.type || 'document', // 如果 metadata.json 沒有指定 type，預設為 document
                    tags: metaItem.tags || [],
                    description: metaItem.description || `沒有描述 - ${metaItem.path}`,
                    download_url: downloadUrl // 直接構造下載連結
                };
            });

            loadingMessage.style.display = 'none'; // 隱藏載入訊息
            renderItems(allItems);
            renderTags();

        } catch (error) {
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            itemsGrid.innerHTML = ''; // 清空網格
        }
    }

    // --- 渲染函數 ---
    // (這部分程式碼與之前版本相同，因為資料結構一致，只是來源不同)

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
            const icon = item.type === 'image' ? '🖼️' : (item.name.endsWith('.pdf') ? '📄' : '📝');

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
                tagSpan.classList.toggle('active');
                applyFilters();
            });
            tagsContainer.appendChild(tagSpan);
        });
    }

    // --- 篩選與搜尋邏輯 ---
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        const filtered = allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.description.toLowerCase().includes(searchTerm) ||
                                  item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesTags = activeTags.length === 0 || activeTags.every(tag => item.tags.includes(tag));
            
            return matchesSearch && matchesTags;
        });
        renderItems(filtered);
    }
    
    searchInput.addEventListener('input', applyFilters);

    // --- 浮動視窗 (Modal) 邏輯 ---
    // (這部分程式碼與之前版本相同，因為 download_url 的使用方式不變)

    // 顯示浮動視窗
    async function showModal(item) {
        currentItem = item;
        modalBody.innerHTML = ''; // 清空內容

        let contentHTML = '';
        let fileContent = '';

        try {
            // 直接使用 item.download_url
            const response = await fetch(item.download_url);
            if (!response.ok) {
                throw new Error(`無法獲取檔案內容: ${response.statusText}`);
            }
            if (item.type === 'image') {
                contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
            } else if (item.type === 'document') {
                fileContent = await response.text();
                if (item.name.toLowerCase().endsWith('.md')) { // 判斷副檔名
                    contentHTML = `<div class="markdown-body">${marked.parse(fileContent)}</div>`;
                } else if (item.name.toLowerCase().endsWith('.pdf')) { // 判斷副檔名
                    contentHTML = `<iframe src="${item.download_url}" frameborder="0"></iframe>`;
                } else {
                    contentHTML = `<pre>${fileContent.substring(0, 500)}...</pre><p>僅顯示部分內容或檔案類型不支援預覽。</p>`;
                }
            } else {
                contentHTML = `<p>檔案類型 "${item.type}" 或副檔名無法預覽。</p>`;
            }
        } catch (error) {
            console.error('預覽內容載入失敗:', error);
            contentHTML = `<p style="color: red;">載入預覽內容失敗：${error.message}。請確認 ${item.path} 存在。</p>`;
        }
        
        modalBody.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="modal-content-body">${contentHTML}</div>
        `;
        
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
        
        const pinBtn = document.getElementById('pin-button');
        if (pinBtn) {
            pinBtn.textContent = isPinned ? '★ 釘選' : '★ 已釘選';
        }
    }

    // --- 初始載入 ---
    initializeData();
});