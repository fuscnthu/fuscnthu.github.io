document.addEventListener('DOMContentLoaded', async () => {
    // --- 請務必替換成你的 GitHub 帳號和儲存庫名稱 ---
    const GITHUB_USERNAME = '你的GitHub帳號';
    const REPO_NAME = '你的儲存庫名稱';
    // --- 以上 ---

    const METADATA_FILE = 'metadata.json';

    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const fileTreeContainer = document.getElementById('file-tree'); // 新增：檔案樹容器
    const loadingMessage = document.getElementById('loading-message');
    const rightPanelViewer = document.getElementById('right-panel-viewer'); // 新增：右側檢視器
    const viewerTitle = document.getElementById('viewer-title');
    const viewerContent = document.getElementById('viewer-content');
    const viewerPinButton = document.getElementById('viewer-pin-button');
    const viewerNewTabButton = document.getElementById('viewer-new-tab-button');
    const viewerCloseButton = document.getElementById('viewer-close-button');
    const contentDisplayArea = document.getElementById('content-display-area'); // 佔位訊息區

    let allItems = []; // 儲存所有處理過的檔案資料
    let fileTreeData = {}; // 儲存建構好的檔案樹結構
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null; // 目前在右側檢視器中顯示的項目

    // --- 輔助函數：資料處理 ---

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

            fileTreeData = buildFileTree(allItems); // 建構檔案樹結構

            loadingMessage.style.display = 'none';
            renderFileTree(fileTreeData); // 渲染檔案樹
            renderTags(); // 渲染標籤
            contentDisplayArea.style.display = 'flex'; // 顯示預設的佔位訊息

        } catch (error) {
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            fileTreeContainer.innerHTML = '';
        }
    }

    // 建構檔案樹數據結構
    function buildFileTree(items) {
        const tree = {};

        items.forEach(item => {
            const pathParts = item.path.split('/');
            let currentLevel = tree;

            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) { // 這是檔案本身
                    currentLevel[part] = item; // 將完整的 item 物件存入
                } else { // 這是資料夾
                    if (!currentLevel[part]) {
                        currentLevel[part] = { _isFolder: true }; // 標記為資料夾
                    }
                    currentLevel = currentLevel[part];
                }
            });
        });
        return tree;
    }

    // 渲染檔案樹
    function renderFileTree(tree, parentElement = fileTreeContainer, currentPath = '') {
        // 清空容器，除了第一次渲染
        if (parentElement === fileTreeContainer) {
            parentElement.innerHTML = '';
            const rootUl = document.createElement('ul');
            rootUl.className = 'file-tree-root';
            parentElement.appendChild(rootUl);
            parentElement = rootUl;
        }

        const sortedKeys = Object.keys(tree).sort((a, b) => {
            const aIsFolder = tree[a]._isFolder;
            const bIsFolder = tree[b]._isFolder;
            // 資料夾排在前面，然後按名稱排序
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        });

        for (const key of sortedKeys) {
            const item = tree[key];
            const li = document.createElement('li');
            const fullPath = currentPath ? `${currentPath}/${key}` : key;

            if (item._isFolder) {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                folderDiv.innerHTML = `<span class="folder-icon">📂</span> ${key}`;
                li.appendChild(folderDiv);

                const ul = document.createElement('ul');
                ul.style.display = 'none'; // 預設隱藏子資料夾
                li.appendChild(ul);

                folderDiv.addEventListener('click', () => {
                    ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
                    folderDiv.querySelector('.folder-icon').textContent = ul.style.display === 'none' ? '📂' : '📁';
                });
                renderFileTree(item, ul, fullPath); // 遞迴渲染子資料夾
            } else {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file';
                const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
                fileDiv.innerHTML = `${icon} ${key}`;
                li.appendChild(fileDiv);

                fileDiv.addEventListener('click', () => {
                    // 移除所有活躍狀態
                    document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active'));
                    fileDiv.classList.add('active'); // 設置當前檔案為活躍狀態
                    showViewer(item); // 顯示右側檢視器
                });
            }
            parentElement.appendChild(li);
        }
    }

    // --- 標籤相關邏輯 ---

    function renderTags() {
        const allTags = [...new Set(allItems.flatMap(item => item.tags))];
        tagsContainer.innerHTML = '';

        const currentActiveTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        allTags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.textContent = tag;

            if (currentActiveTags.includes(tag)) {
                tagSpan.classList.add('active');
            }

            tagSpan.addEventListener('click', () => {
                tagSpan.classList.toggle('active');
                applyFilters();
                updateTagOrder();
            });
            tagsContainer.appendChild(tagSpan);
        });
        updateTagOrder();
    }

    function updateTagOrder() {
        const activeTags = [];
        const inactiveTags = [];

        tagsContainer.querySelectorAll('.tag').forEach(tagSpan => {
            if (tagSpan.classList.contains('active')) {
                activeTags.push(tagSpan);
            } else {
                inactiveTags.push(tagSpan);
            }
        });

        tagsContainer.innerHTML = '';
        activeTags.forEach(tagSpan => tagsContainer.appendChild(tagSpan));
        inactiveTags.forEach(tagSpan => tagsContainer.appendChild(tagSpan));
    }

    // --- 搜尋與篩選邏輯 ---

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        const filteredItems = allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.description.toLowerCase().includes(searchTerm) ||
                                  item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesTags = activeTags.length === 0 || activeTags.every(tag => item.tags.includes(tag));
            
            return matchesSearch && matchesTags;
        });
        
        // 根據篩選結果重新渲染檔案樹
        const filteredTree = buildFileTree(filteredItems);
        renderFileTree(filteredTree);

        // 如果目前檢視的檔案不符合篩選條件，則關閉檢視器
        if (currentItem && !filteredItems.some(item => item.path === currentItem.path)) {
            hideViewer();
        }
    }
    
    searchInput.addEventListener('input', applyFilters);


    // --- 右側檢視器邏輯 (取代舊的 showModal) ---

    async function showViewer(item) {
        currentItem = item;
        viewerTitle.textContent = item.name;
        viewerContent.innerHTML = ''; // 清空內容

        let contentHTML = '';
        
        // 檢查檔案類型和副檔名
        const fileExtension = item.name.toLowerCase().split('.').pop();

        if (item.type === 'image') {
            contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
        } else if (item.type === 'document') {
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
                contentHTML = `
                    <p style="text-align: center;">此為 Word 文件，無法直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
            } else {
                contentHTML = `
                    <p style="text-align: center;">檔案類型 ${fileExtension} 不支援直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
            }
        } else {
            contentHTML = `<p>檔案類型 "${item.type}" 不支援預覽。</p>`;
        }
        
        viewerContent.innerHTML = contentHTML;

        // 更新訂選按鈕狀態
        updatePinButtonState();
        // 更新在新分頁開啟按鈕
        viewerNewTabButton.href = item.download_url;

        rightPanelViewer.classList.add('active'); // 顯示右側檢視器
        contentDisplayArea.style.display = 'none'; // 隱藏預設佔位訊息
    }

    function hideViewer() {
        rightPanelViewer.classList.remove('active');
        currentItem = null;
        viewerContent.innerHTML = ''; // 清空內容
        document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active')); // 移除檔案選中狀態
        contentDisplayArea.style.display = 'flex'; // 重新顯示預設佔位訊息
    }

    viewerCloseButton.addEventListener('click', hideViewer);

    viewerPinButton.addEventListener('click', togglePin);

    // 釘選/取消釘選功能 (更新以使用新的按鈕 ID)
    function togglePin() {
        if (!currentItem) return;

        const isPinned = pinnedItems.some(p => p.path === currentItem.path);
        if (isPinned) {
            pinnedItems = pinnedItems.filter(p => p.path !== currentItem.path);
        } else {
            pinnedItems.push(currentItem);
        }

        localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
        updatePinButtonState(); // 更新按鈕狀態
    }

    function updatePinButtonState() {
        if (currentItem) {
            const isPinned = pinnedItems.some(p => p.path === currentItem.path);
            viewerPinButton.textContent = isPinned ? '★ 已釘選' : '★ 釘選';
        }
    }


    // --- 初始載入 ---
    initializeData();
});