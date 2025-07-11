import { CacheManager } from './utils/cacheManager.js'; // 請確保路徑正確

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 網站設定常數 ---
    const GITHUB_USERNAME = 'fuscnthu'; // GitHub 使用者名稱
    const REPO_NAME = 'fuscnthu.github.io'; // 儲存庫名稱
    const METADATA_FILE = 'metadata.json'; // 儲存庫根目錄下的中介資料檔名

    // --- DOM 元素引用 ---
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const loadingMessage = document.getElementById('loading-message');
    const rightPanelViewer = document.getElementById('right-panel-viewer');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerContent = document.getElementById('viewer-content');
    const viewerPinButton = document.getElementById('viewer-pin-button');
    const viewerNewTabButton = document.getElementById('viewer-new-tab-button');
    const viewerCloseButton = document.getElementById('viewer-close-button');
    const contentDisplayArea = document.getElementById('content-display-area');

    const fileTreePathContainer = document.getElementById('file-tree-path');
    const homeButton = document.getElementById('home-button');
    const fileListContainer = document.getElementById('file-list');

    // 新增的 DOM 元素引用
    const pinnedItemsPanel = document.getElementById('pinned-items-panel');
    const pinnedItemsList = document.getElementById('pinned-items-list');
    const noPinnedItemsMessage = document.getElementById('no-pinned-items');


    // --- 全域變數 ---
    let allItems = []; // 包含所有檔案的原始列表
    let fileTreeData = {}; // 完整的樹狀結構資料
    let currentPathParts = []; // 當前瀏覽的路徑片段，如 ['docs', 'subfolder']
    let currentDisplayTree = {}; // 當前正在顯示的資料夾樹狀物件
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null; // 當前在檢視器中打開的項目

    // 實例化 CacheManager
    const cacheManager = new CacheManager();

    // --- 1. 資料初始化與載入 (initializeData) ---
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

            // 隱藏 'utils/' 資料夾下的檔案
            allItems = allItems.filter(item => !item.path.startsWith('utils/'));

            fileTreeData = buildFileTree(allItems);
            
            navigateTo([]); // 導航到根目錄，這會觸發 renderCurrentLevel 和 renderBreadcrumbs

            loadingMessage.style.display = 'none';
            renderTags();
            updatePinButtonState(); // 初始化時更新釘選按鈕狀態
            renderPinnedItems(); // 初始化時渲染釘選面板

            updateMainLayoutClass(); // 初始化時更新主佈局

        } catch (error) {
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            fileListContainer.innerHTML = ''; // 清空列表
        }
    }


    // --- 2. 檔案樹結構建構 (buildFileTree) ---
    function buildFileTree(items) {
        const tree = {};

        items.forEach(item => {
            const pathParts = item.path.split('/');
            let currentLevel = tree;

            pathParts.forEach((part, index) => {
                if (index === pathParts.length - 1) {
                    currentLevel[part] = item;
                } else {
                    if (!currentLevel[part]) {
                        currentLevel[part] = { _isFolder: true };
                    }
                    currentLevel = currentLevel[part];
                }
            });
        });
        return tree;
    }

    // --- 3. 渲染當前層級的檔案和資料夾 (renderCurrentLevel) ---
    function renderCurrentLevel(treeToRender) {
        fileListContainer.innerHTML = ''; // 清空現有列表

        if (!treeToRender || Object.keys(treeToRender).filter(key => key !== '_isFolder').length === 0) {
            fileListContainer.innerHTML = '<p>此資料夾沒有內容。</p>';
            return;
        }

        const filteredKeys = Object.keys(treeToRender).filter(key => key !== '_isFolder');

        const sortedKeys = filteredKeys.sort((a, b) => {
            const aIsFolder = treeToRender[a]._isFolder;
            const bIsFolder = treeToRender[b]._isFolder;
            if (aIsFolder && !bIsFolder) return -1; // 資料夾在前
            if (!aIsFolder && bIsFolder) return 1; // 檔案在後
            return a.localeCompare(b); // 按名稱排序
        });

        for (const key of sortedKeys) {
            const item = treeToRender[key];
            const li = document.createElement('li');
            li.className = 'file-list-item'; // 新增 CSS class

            if (item && item._isFolder) {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder-item';
                folderDiv.innerHTML = `<span class="icon">📂</span> ${key}`;
                li.appendChild(folderDiv);

                // 點擊資料夾進入下一層
                folderDiv.addEventListener('click', () => {
                    const newPathParts = [...currentPathParts, key];
                    navigateTo(newPathParts);
                });
            } else if (item) {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-item';
                const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
                fileDiv.innerHTML = `<span class="icon">${icon}</span> ${key}`;
                li.appendChild(fileDiv);

                // 點擊檔案顯示檢視器
                fileDiv.addEventListener('click', () => {
                    document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
                    fileDiv.classList.add('active');
                    showViewer(item);
                });
            } else {
                console.warn(`在當前資料夾中發現無效項目: ${key}`);
                continue;
            }
            fileListContainer.appendChild(li);
        }
    }

    // --- 4. 渲染路徑導覽 (麵包屑) ---
    function renderBreadcrumbs() {
        fileTreePathContainer.innerHTML = ''; // 清空現有麵包屑

        // 添加首頁按鈕
        fileTreePathContainer.appendChild(homeButton);

        let currentPath = '';
        currentPathParts.forEach((part, index) => {
            currentPath += (currentPath ? '/' : '') + part;
            
            const separator = document.createElement('span');
            separator.className = 'path-separator';
            separator.textContent = ' / ';
            fileTreePathContainer.appendChild(separator);

            const pathSegmentButton = document.createElement('button');
            pathSegmentButton.className = 'path-segment';
            pathSegmentButton.textContent = part;
            // 點擊麵包屑中的某一段，導航到該路徑
            pathSegmentButton.addEventListener('click', () => {
                navigateTo(currentPathParts.slice(0, index + 1));
            });
            fileTreePathContainer.appendChild(pathSegmentButton);
        });
    }

    // --- 5. 導航到指定路徑 ---
    function navigateTo(pathArray) {
        currentItem = null; // 導航時清除當前選中的項目
        hideViewer(); // 導航時關閉檢視器
        
        currentPathParts = pathArray;
        let tempTree = fileTreeData;

        // 遍歷路徑以獲取正確的子樹
        for (const part of currentPathParts) {
            if (tempTree && tempTree[part]) {
                tempTree = tempTree[part];
            } else {
                // 路徑無效，回到根目錄
                console.warn(`無效的路徑片段: ${part}，導航回根目錄。`);
                currentPathParts = [];
                tempTree = fileTreeData;
                break;
            }
        }
        currentDisplayTree = tempTree;
        renderCurrentLevel(currentDisplayTree); // 渲染當前層級內容
        renderBreadcrumbs(); // 更新麵包屑導覽
        updateMainLayoutClass(); // 更新主佈局
    }
    
    // 首頁按鈕事件監聽器
    homeButton.addEventListener('click', () => navigateTo([]));


    // --- 6. 標籤渲染與排序 (renderTags, updateTagOrder) ---
    function renderTags() {
        // 過濾掉被隱藏的 utils 項目，只顯示當前可見項目的標籤
        const visibleItems = allItems.filter(item => !item.path.startsWith('utils/'));
        const allTags = [...new Set(visibleItems.flatMap(item => item.tags))];
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

    // --- 7. 搜尋與篩選邏輯 (applyFilters) ---
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTags = Array.from(document.querySelectorAll('.tag.active')).map(tag => tag.textContent);

        const filteredItems = allItems.filter(item => {
            // 首先過濾掉 utils 項目
            if (item.path.startsWith('utils/')) return false;

            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.description.toLowerCase().includes(searchTerm) ||
                                  item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesTags = activeTags.length === 0 || activeTags.every(tag => item.tags.includes(tag));
            
            return matchesSearch && matchesTags;
        });
        
        const filteredTree = buildFileTree(filteredItems); // 重新建立篩選後的樹

        // 根據當前路徑找到在篩選後樹中的對應節點
        let currentFilteredDisplayTree = filteredTree;
        for (const part of currentPathParts) {
            if (currentFilteredDisplayTree && currentFilteredDisplayTree[part]) {
                currentFilteredDisplayTree = currentFilteredDisplayTree[part];
            } else {
                // 如果篩選後的樹中沒有當前路徑，則顯示空內容
                currentFilteredDisplayTree = { _isFolder: true }; // 確保是個有效的空資料夾物件
                break;
            }
        }
        renderCurrentLevel(currentFilteredDisplayTree); // 渲染篩選後的當前層級內容

        if (currentItem && !filteredItems.some(item => item.path === currentItem.path)) {
            hideViewer();
        }
    }
    searchInput.addEventListener('input', applyFilters);

    // --- 8. 右側檢視器功能 (showViewer, hideViewer, togglePin, updatePinButtonState) ---
    async function showViewer(item) {
        currentItem = item;
        viewerTitle.textContent = item.name;
        viewerContent.innerHTML = '';

        let contentHTML = '';
        const fileExtension = item.name.toLowerCase().split('.').pop();

        let cachedContent = cacheManager.get(item.path);

        if (cachedContent) {
            contentHTML = cachedContent;
        } else {
            try {
                if (item.type === 'document' && fileExtension !== 'pdf') { // 文檔類型，且不是 PDF
                    const response = await fetch(item.download_url);
                    if (!response.ok) throw new Error(`無法獲取內容: ${response.statusText}`);
                    const rawContent = await response.text();

                    if (fileExtension === 'md') {
                        contentHTML = `<div class="markdown-body">${marked.parse(rawContent)}</div>`;
                    } else if (fileExtension === 'docx') {
                        contentHTML = `
                            <p style="text-align: center;">此為 Word 文件，無法直接預覽。</p>
                            <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                        `;
                    } else { // 其他不支援預覽的文檔類型
                        contentHTML = `
                            <p style="text-align: center;">檔案類型 ${fileExtension} 不支援直接預覽。</p>
                            <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                        `;
                    }
                    cacheManager.set(item.path, contentHTML);

                } else if (item.type === 'image') {
                    contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
                } else if (fileExtension === 'pdf') {
                    // --- 優化：PDF 使用 Google Docs Viewer 嵌入預覽 ---
                    contentHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(item.download_url)}&embedded=true" frameborder="0"></iframe>`;
                } else { 
                    contentHTML = `<p>檔案類型 "${item.type}" 或副檔名無法預覽。</p>`;
                    cacheManager.set(item.path, contentHTML);
                }

            } catch (error) {
                console.error('預覽內容載入失敗:', error);
                contentHTML = `<p style="color: red;">載入預覽內容失敗：${error.message}。請確認 ${item.path} 存在。</p>`;
                cacheManager.set(item.path, contentHTML, false);
            }
        }
        
        viewerContent.innerHTML = contentHTML;

        updatePinButtonState(); // 更新釘選按鈕狀態
        viewerNewTabButton.href = item.download_url;

        rightPanelViewer.classList.add('active'); // 顯示右側檢視器
        updateMainLayoutClass(); // 更新主佈局（會導致 contentDisplayArea 隱藏）
    }

    function hideViewer() {
        rightPanelViewer.classList.remove('active');
        currentItem = null; // 清除當前選中的項目
        viewerContent.innerHTML = '';
        document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
        updateMainLayoutClass(); // 更新主佈局（會導致 contentDisplayArea 顯示或 sidebar 擴展）
    }

    viewerCloseButton.addEventListener('click', hideViewer);

    viewerPinButton.addEventListener('click', togglePin);

    function togglePin() {
        if (!currentItem) return;

        const isPinned = pinnedItems.some(p => p.path === currentItem.path);
        if (isPinned) {
            pinnedItems = pinnedItems.filter(p => p.path !== currentItem.path);
        } else {
            // 檢查是否已存在，避免重複釘選
            if (!isPinned) {
                pinnedItems.push(currentItem);
            }
        }

        localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
        updatePinButtonState(); // 更新釘選按鈕顯示狀態
        renderPinnedItems(); // 更新釘選面板
    }

    function updatePinButtonState() {
        if (currentItem) {
            const isPinned = pinnedItems.some(p => p.path === currentItem.path);
            viewerPinButton.textContent = isPinned ? '★ 已釘選' : '★ 釘選';
        } else {
            viewerPinButton.textContent = '★ 釘選'; // 沒有選中項目時顯示預設狀態
        }
    }

    // --- 9. 釘選面板功能 ---
    function renderPinnedItems() {
        pinnedItemsList.innerHTML = ''; // 清空列表

        if (pinnedItems.length === 0) {
            noPinnedItemsMessage.style.display = 'block';
            pinnedItemsPanel.classList.remove('has-items');
            return;
        }

        noPinnedItemsMessage.style.display = 'none';
        pinnedItemsPanel.classList.add('has-items');

        pinnedItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'pinned-item';
            const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
            li.innerHTML = `
                <span class="pinned-item-info">
                    <span class="icon">${icon}</span>
                    <span class="name">${item.name}</span>
                </span>
                <button class="pinned-item-remove" data-path="${item.path}">&times;</button>
            `;
            
            // 點擊項目打開檢視器
            li.querySelector('.pinned-item-info').addEventListener('click', () => {
                showViewer(item);
            });

            // 點擊移除按鈕
            li.querySelector('.pinned-item-remove').addEventListener('click', (event) => {
                event.stopPropagation(); // 防止觸發父元素的點擊事件
                pinnedItems = pinnedItems.filter(p => p.path !== item.path);
                localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
                renderPinnedItems(); // 重新渲染釘選面板
                updatePinButtonState(); // 更新檢視器中的釘選按鈕狀態
                // 如果當前在檢視器中顯示的正是被取消釘選的項目，則清除 currentItem 並更新佈局
                if (currentItem && currentItem.path === item.path) {
                    currentItem = null;
                    updateMainLayoutClass();
                }
            });

            pinnedItemsList.appendChild(li);
        });
    }


    // --- 10. 主佈局更新邏輯 ---
    function updateMainLayoutClass() {
        if (currentItem === null) { // 沒有選中的檔案 (檢視器已關閉)
            document.body.classList.add('sidebar-expanded');
            contentDisplayArea.style.display = 'none'; // 隱藏佔位內容區
        } else { // 有選中的檔案 (檢視器開啟或剛關閉)
            document.body.classList.remove('sidebar-expanded');
            if (rightPanelViewer.classList.contains('active')) {
                // 如果檢視器開啟，隱藏佔位內容區
                contentDisplayArea.style.display = 'none';
                document.body.classList.add('viewer-active');
            } else {
                // 如果檢視器關閉但有項目曾被選中，顯示佔位內容區
                contentDisplayArea.style.display = 'flex';
                document.body.classList.remove('viewer-active');
            }
        }
    }


    // --- 11. 網站啟動 ---
    initializeData();
});