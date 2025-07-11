document.addEventListener('DOMContentLoaded', async () => {
    // --- 網站設定常數 ---
    // 這部分需要替換為您的 GitHub 帳號和儲存庫名稱。
    const GITHUB_USERNAME = 'fuscnthu'; // GitHub 使用者名稱
    const REPO_NAME = 'fuscnthu.github.io'; // 儲存庫名稱
    const METADATA_FILE = 'metadata.json'; // 儲存庫根目錄下的中介資料檔名

    // --- DOM 元素引用 ---
    // 獲取 HTML 中各個介面元素的引用，方便後續操作。
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const fileTreeContainer = document.getElementById('file-tree'); // 檔案樹容器
    const loadingMessage = document.getElementById('loading-message'); // 載入訊息
    const rightPanelViewer = document.getElementById('right-panel-viewer'); // 右側檢視器主體
    const viewerTitle = document.getElementById('viewer-title'); // 檢視器標題
    const viewerContent = document.getElementById('viewer-content'); // 檢視器內容區
    const viewerPinButton = document.getElementById('viewer-pin-button'); // 釘選按鈕
    const viewerNewTabButton = document.getElementById('viewer-new-tab-button'); // 新分頁開啟按鈕
    const viewerCloseButton = document.getElementById('viewer-close-button'); // 關閉按鈕
    const contentDisplayArea = document.getElementById('content-display-area'); // 左側預設佔位訊息區

    // --- 全域變數 ---
    // 儲存網站運行的核心數據和狀態。
    let allItems = []; // 儲存從 metadata.json 載入的所有檔案資料
    let fileTreeData = {}; // 儲存建構好的檔案樹結構 (JSON 物件形式)
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || []; // 從 localStorage 載入釘選項目
    let currentItem = null; // 目前在右側檢視器中顯示的檔案項目
    const fileContentCache = {}; // **新增：用於快取檔案內容，減少 API 請求**

    // --- 1. 資料初始化與載入 (initializeData) ---
    // 負責網站啟動時的所有數據準備工作。
    async function initializeData() {
        loadingMessage.style.display = 'block'; // 顯示載入訊息

        const metadataUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${METADATA_FILE}`;
        
        try {
            // 從 GitHub Raw URL 獲取 metadata.json
            const response = await fetch(metadataUrl);
            if (!response.ok) {
                throw new Error(`無法獲取 ${METADATA_FILE}: ${response.statusText}`);
            }
            const metadata = await response.json();

            // 處理 metadata 數據，為每個檔案生成下載 URL 並標準化格式
            allItems = metadata.map(metaItem => {
                const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/main/${metaItem.path}`;
                return {
                    name: metaItem.path.split('/').pop(), // 檔案名
                    path: metaItem.path, // 完整路徑
                    type: metaItem.type || 'document', // 檔案類型，預設為 document
                    tags: metaItem.tags || [], // 標籤列表
                    description: metaItem.description || `沒有描述 - ${metaItem.path}`, // 描述
                    download_url: downloadUrl // 原始內容下載連結
                };
            });

            fileTreeData = buildFileTree(allItems); // **建構檔案樹結構**
            loadingMessage.style.display = 'none'; // 隱藏載入訊息

            renderFileTree(fileTreeData); // **渲染左側的檔案樹介面**
            renderTags(); // 渲染標籤列表
            contentDisplayArea.style.display = 'flex'; // 顯示預設的右側佔位訊息

        } catch (error) {
            // 處理資料載入失敗的情況，並在介面顯示錯誤訊息。
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            fileTreeContainer.innerHTML = '';
        }
    }

    // --- 2. 檔案樹結構建構 (buildFileTree) ---
    // 將扁平化的檔案列表 (allItems) 轉換成巢狀的樹狀結構，以便於渲染為檔案瀏覽器。
    function buildFileTree(items) {
        const tree = {};
        items.forEach(item => {
            const pathParts = item.path.split('/'); // 將路徑按 '/' 分割
            let currentLevel = tree;

            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) { // 這是檔案本身
                    currentLevel[part] = item; // 將完整的 item 物件存入樹中
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

    // --- 3. 檔案樹渲染 (renderFileTree) ---
    // 根據 `fileTreeData` 結構，在 `fileTreeContainer` 中動態生成 HTML 檔案樹。
    function renderFileTree(tree, parentElement = fileTreeContainer, currentPath = '') {
        // 清空容器（除了第一次渲染根目錄）並創建根 UL 元素。
        if (parentElement === fileTreeContainer) {
            parentElement.innerHTML = '';
            const rootUl = document.createElement('ul');
            rootUl.className = 'file-tree-root';
            parentElement.appendChild(rootUl);
            parentElement = rootUl;
        }

        // 排序：資料夾排在前面，然後按名稱排序。
        const sortedKeys = Object.keys(tree).sort((a, b) => {
            const aIsFolder = tree[a]._isFolder;
            const bIsFolder = tree[b]._isFolder;
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        });

        for (const key of sortedKeys) {
            const item = tree[key];
            const li = document.createElement('li');
            const fullPath = currentPath ? `${currentPath}/${key}` : key;

            if (item._isFolder) {
                // 如果是資料夾，創建資料夾 DIV 和子 UL 列表
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                folderDiv.innerHTML = `<span class="folder-icon">📂</span> ${key}`;
                li.appendChild(folderDiv);

                const ul = document.createElement('ul');
                ul.style.display = 'none'; // 預設隱藏子資料夾
                li.appendChild(ul);

                // 點擊資料夾時展開/收縮子列表，並切換圖示。
                folderDiv.addEventListener('click', () => {
                    ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
                    folderDiv.querySelector('.folder-icon').textContent = ul.style.display === 'none' ? '📂' : '📁';
                });
                renderFileTree(item, ul, fullPath); // 遞迴渲染子資料夾
            } else {
                // 如果是檔案，創建檔案 DIV 並設定圖示。
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file';
                const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
                fileDiv.innerHTML = `${icon} ${key}`;
                li.appendChild(fileDiv);

                // 點擊檔案時，顯示右側檢視器內容，並標記為活躍狀態。
                fileDiv.addEventListener('click', () => {
                    document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active')); // 移除其他檔案的活躍狀態
                    fileDiv.classList.add('active'); // 設置當前檔案為活躍狀態
                    showViewer(item); // 顯示右側檢視器
                });
            }
            parentElement.appendChild(li);
        }
    }

    // --- 4. 標籤渲染與排序 (renderTags, updateTagOrder) ---
    // 處理網站頂部的標籤列表，包括顯示、點擊互動、顏色變化和排序。
    function renderTags() {
        const allTags = [...new Set(allItems.flatMap(item => item.tags))]; // 獲取所有不重複的標籤
        tagsContainer.innerHTML = '';

        const currentActiveTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        allTags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.textContent = tag;

            if (currentActiveTags.includes(tag)) { // 如果之前選中過，則重新標記為 active
                tagSpan.classList.add('active');
            }

            tagSpan.addEventListener('click', () => {
                tagSpan.classList.toggle('active'); // 切換 active 狀態
                applyFilters(); // 重新應用篩選
                updateTagOrder(); // 更新標籤排序
            });
            tagsContainer.appendChild(tagSpan);
        });
        updateTagOrder(); // 初始渲染後也更新一次排序
    }

    // 將活躍標籤移到最前面，非活躍標籤保持原位。
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

        tagsContainer.innerHTML = ''; // 清空容器
        activeTags.forEach(tagSpan => tagsContainer.appendChild(tagSpan)); // 先添加活躍標籤
        inactiveTags.forEach(tagSpan => tagsContainer.appendChild(tagSpan)); // 再添加非活躍標籤
    }

    // --- 5. 搜尋與篩選邏輯 (applyFilters) ---
    // 根據搜尋框的輸入和選中的標籤，過濾檔案樹的顯示內容。
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        // 過濾 allItems，找出符合搜尋關鍵字和所有選定標籤的項目。
        const filteredItems = allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.description.toLowerCase().includes(searchTerm) ||
                                  item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesTags = activeTags.length === 0 || activeTags.every(tag => item.tags.includes(tag));
            
            return matchesSearch && matchesTags;
        });
        
        // 根據篩選結果重新建構並渲染檔案樹。
        const filteredTree = buildFileTree(filteredItems);
        renderFileTree(filteredTree);

        // 如果目前正在右側檢視器顯示的檔案不符合篩選條件，則自動關閉檢視器。
        if (currentItem && !filteredItems.some(item => item.path === currentItem.path)) {
            hideViewer();
        }
    }
    // 綁定搜尋框的輸入事件。
    searchInput.addEventListener('input', applyFilters);

    // --- 6. 右側檢視器功能 (showViewer, hideViewer, togglePin, updatePinButtonState) ---
    // 這是取代了之前的全螢幕 Modal，實現右半邊螢幕顯示檔案內容的功能。
    async function showViewer(item) {
        currentItem = item; // 設定目前檢視的項目
        viewerTitle.textContent = item.name; // 更新檢視器標題
        viewerContent.innerHTML = ''; // 清空檢視器內容區

        let contentHTML = '';
        const fileExtension = item.name.toLowerCase().split('.').pop();

        // **優化：檢查檔案內容是否已在快取中**
        if (fileContentCache[item.path]) {
            console.log(`從快取載入：${item.path}`);
            contentHTML = fileContentCache[item.path]; // 直接從快取獲取 HTML 內容
        } else {
            // 如果不在快取中，才發送網路請求獲取內容。
            try {
                if (item.type === 'document' && fileExtension !== 'pdf') { // 文檔類型且非 PDF (PDF 瀏覽器自行處理快取)
                    const response = await fetch(item.download_url);
                    if (!response.ok) throw new Error(`無法獲取內容: ${response.statusText}`);
                    const rawContent = await response.text(); // 獲取原始文本內容

                    if (fileExtension === 'md') {
                        // Markdown 轉為 HTML 並儲存快取。
                        contentHTML = `<div class="markdown-body">${marked.parse(rawContent)}</div>`;
                    } else if (fileExtension === 'docx') {
                        // DOCX 檔案顯示下載連結並儲存快取。
                        contentHTML = `
                            <p style="text-align: center;">此為 Word 文件，無法直接預覽。</p>
                            <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                        `;
                    } else {
                        // 其他不支援預覽的文件類型，顯示下載連結。
                        contentHTML = `
                            <p style="text-align: center;">檔案類型 ${fileExtension} 不支援直接預覽。</p>
                            <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                        `;
                    }
                    fileContentCache[item.path] = contentHTML; // 將生成的 HTML 內容存入快取
                } else if (item.type === 'image') {
                    // 圖片直接使用 download_url，瀏覽器會處理圖片本身的快取。
                    contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
                } else if (fileExtension === 'pdf') {
                    // PDF 使用 iframe 內嵌，瀏覽器會處理 PDF 內容的下載和快取。
                    contentHTML = `<iframe src="${item.download_url}" frameborder="0"></iframe>`;
                } else {
                    // 未知或未處理的類型。
                    contentHTML = `<p>檔案類型 "${item.type}" 或副檔名無法預覽。</p>`;
                }

            } catch (error) {
                console.error('預覽內容載入失敗:', error);
                contentHTML = `<p style="color: red;">載入預覽內容失敗：${error.message}。請確認 ${item.path} 存在。</p>`;
            }
        }
        
        viewerContent.innerHTML = contentHTML; // 將內容填充到檢視器

        updatePinButtonState(); // 更新釘選按鈕狀態
        viewerNewTabButton.href = item.download_url; // 設定新分頁開啟連結

        rightPanelViewer.classList.add('active'); // 顯示右側檢視器
        contentDisplayArea.style.display = 'none'; // 隱藏左側預設佔位訊息
    }

    // 隱藏右側檢視器，並恢復預設介面狀態。
    function hideViewer() {
        rightPanelViewer.classList.remove('active');
        currentItem = null;
        viewerContent.innerHTML = '';
        document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active')); // 移除所有檔案的活躍狀態
        contentDisplayArea.style.display = 'flex'; // 重新顯示左側預設佔位訊息
    }
    // 綁定關閉按鈕事件。
    viewerCloseButton.addEventListener('click', hideViewer);

    // 釘選/取消釘選邏輯，將項目儲存到瀏覽器的 localStorage 中。
    viewerPinButton.addEventListener('click', togglePin);

    function togglePin() {
        if (!currentItem) return;

        const isPinned = pinnedItems.some(p => p.path === currentItem.path);
        if (isPinned) {
            pinnedItems = pinnedItems.filter(p => p.path !== currentItem.path);
        } else {
            pinnedItems.push(currentItem);
        }

        localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems)); // 更新 localStorage
        updatePinButtonState(); // 更新釘選按鈕文字
    }

    // 根據 `currentItem` 是否被釘選，更新釘選按鈕的文字。
    function updatePinButtonState() {
        if (currentItem) {
            const isPinned = pinnedItems.some(p => p.path === currentItem.path);
            viewerPinButton.textContent = isPinned ? '★ 已釘選' : '★ 釘選';
        }
    }

    // --- 7. 網站啟動 ---
    // 確保 DOM 完全載入後才執行初始化。
    initializeData();
});