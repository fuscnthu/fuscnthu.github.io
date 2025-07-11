document.addEventListener('DOMContentLoaded', async () => {
    // --- 請務必替換成你的 GitHub 帳號和儲存庫名稱 ---
    const GITHUB_USERNAME = '你的GitHub帳號';
    const REPO_NAME = '你的儲存庫名稱';
    // --- 以上 ---

    const METADATA_FILE = 'metadata.json';

    const itemsGrid = document.getElementById('items-grid');
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const modal = document.getElementById('modal');
    const modalBody = document.querySelector('.modal-body');
    const closeModalBtn = document.querySelector('.close-button');
    const loadingMessage = document.getElementById('loading-message');

    let allItems = [];
    let displayedItems = [];
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null;

    // --- 輔助函數 ---

    async function initializeData() {
        loadingMessage.style.display = 'block';

        const metadataUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${METADATA_FILE}`;
        
        try {
            const response = await fetch(metadataUrl);
            if (!response.ok) {
                throw new Error(`無法獲取 ${METADATA_FILE}: ${response.statusText}`);
            }
            const metadata = await response.json();

            allItems = metadata.map(metaItem => {
                const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${metaItem.path}`;
                return {
                    name: metaItem.path.split('/').pop(),
                    path: metaItem.path,
                    type: metaItem.type || 'document',
                    tags: metaItem.tags || [],
                    description: metaItem.description || `沒有描述 - ${metaItem.path}`,
                    download_url: downloadUrl
                };
            });

            loadingMessage.style.display = 'none';
            renderItems(allItems);
            renderTags();

        } catch (error) {
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            itemsGrid.innerHTML = '';
        }
    }

    // --- 渲染函數 ---

    function renderItems(items) {
        displayedItems = items;
        itemsGrid.innerHTML = '';
        if (items.length === 0) {
            itemsGrid.innerHTML = '<p style="text-align: center; color: var(--primary-color);">沒有找到符合條件的項目。</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            let cardContentHTML = '';

            if (item.type === 'image') {
                // 如果是圖片，直接顯示圖片和檔名
                cardContentHTML = `
                    <div class="item-card-image-container">
                        <img src="${item.download_url}" alt="${item.name}">
                    </div>
                    <div class="item-header">
                        <h3>${item.name}</h3>
                    </div>
                `;
            } else {
                // 其他文件類型，顯示圖示和檔名
                const icon = item.name.toLowerCase().endsWith('.pdf') ? '📄' : 
                             (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📁'); // docx 使用一個特殊的圖示
                cardContentHTML = `
                    <div class="item-header">
                        <span class="icon-placeholder">${icon}</span>
                        <h3>${item.name}</h3>
                    </div>
                `;
            }
            
            card.innerHTML = cardContentHTML;
            
            card.addEventListener('click', () => showModal(item));
            itemsGrid.appendChild(card);
        });
    }

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

    async function showModal(item) {
        currentItem = item;
        modalBody.innerHTML = '';

        let contentHTML = '';
        
        // 檢查檔案類型和副檔名
        if (item.type === 'image') {
            contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
        } else if (item.type === 'document') {
            const fileExtension = item.name.toLowerCase().split('.').pop();
            
            if (fileExtension === 'md') {
                try {
                    const response = await fetch(item.download_url);
                    if (!response.ok) throw new Error(`無法獲取 Markdown 內容: ${response.statusText}`);
                    const markdownContent = await response.text();
                    contentHTML = `<div class="markdown-body">${marked.parse(markdownContent)}</div>`;
                } catch (error) {
                    console.error('Markdown 預覽載入失敗:', error);
                    contentHTML = `<p style="color: red;">載入 Markdown 預覽失敗：${error.message}。</p>`;
                }
            } else if (fileExtension === 'pdf') {
                contentHTML = `<iframe src="${item.download_url}" frameborder="0"></iframe>`;
            } else if (fileExtension === 'docx') {
                // 對於 DOCX 檔案，提供下載連結
                contentHTML = `
                    <p style="text-align: center;">此為 Word 文件，無法直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
            } else {
                // 其他不支援預覽的文件類型
                contentHTML = `
                    <p style="text-align: center;">檔案類型 ${fileExtension} 不支援直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
            }
        } else {
            contentHTML = `<p>檔案類型 "${item.type}" 不支援預覽。</p>`;
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

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        currentItem = null;
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

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

    initializeData();
});