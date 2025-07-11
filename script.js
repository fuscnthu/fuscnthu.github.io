import { CacheManager } from './utils/cacheManager.js'; // 請確保路徑正確

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 網站設定常數 ---
    // 這部分需要替換為您的 GitHub 帳號和儲存庫名稱。
    const GITHUB_USERNAME = 'fuscnthu'; // GitHub 使用者名稱
    const REPO_NAME = 'fuscnthu.github.io'; // 儲存庫名稱
    const METADATA_FILE = 'metadata.json'; // 儲存庫根目錄下的中介資料檔名

    // --- DOM 元素引用 ---
    const searchInput = document.getElementById('searchInput');
    const tagsContainer = document.getElementById('tags-container');
    const fileTreeContainer = document.getElementById('file-tree'); // 新增的檔案樹容器
    const loadingMessage = document.getElementById('loading-message');
    const rightPanelViewer = document.getElementById('right-panel-viewer');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerContent = document.getElementById('viewer-content');
    const viewerPinButton = document.getElementById('viewer-pin-button');
    const viewerNewTabButton = document.getElementById('viewer-new-tab-button');
    const viewerCloseButton = document.getElementById('viewer-close-button');
    const contentDisplayArea = document.getElementById('content-display-area'); // 新增的內容顯示區

    // --- 全域變數 ---
    let allItems = [];
    let fileTreeData = {};
    let pinnedItems = JSON.parse(localStorage.getItem('pinnedItems')) || [];
    let currentItem = null;

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

            // --- 新增功能：隱藏 'utils/' 資料夾下的檔案 ---
            allItems = allItems.filter(item => !item.path.startsWith('utils/'));

            fileTreeData = buildFileTree(allItems);

            loadingMessage.style.display = 'none';
            renderFileTree(fileTreeData);
            renderTags();
            contentDisplayArea.style.display = 'flex'; // 顯示內容顯示區

        } catch (error) {
            console.error('初始化資料失敗:', error);
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            fileTreeContainer.innerHTML = '';
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

    // --- 3. 檔案樹渲染 (renderFileTree) ---
    function renderFileTree(tree, parentElement = fileTreeContainer, currentPath = '') {
        if (parentElement === fileTreeContainer) {
            parentElement.innerHTML = '';
            const rootUl = document.createElement('ul');
            rootUl.className = 'file-tree-root';
            parentElement.appendChild(rootUl);
            parentElement = rootUl;
        }

        // --- 修正：過濾掉 _isFolder 屬性，避免在遍歷時將其誤讀為檔案 ---
        const filteredKeys = Object.keys(tree).filter(key => key !== '_isFolder');

        const sortedKeys = filteredKeys.sort((a, b) => {
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

            if (item && item._isFolder) { 
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                folderDiv.innerHTML = `<span class="folder-icon">📂</span> ${key}`;
                li.appendChild(folderDiv);

                const ul = document.createElement('ul');
                ul.style.display = 'none';
                li.appendChild(ul);

                folderDiv.addEventListener('click', () => {
                    ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
                    folderDiv.querySelector('.folder-icon').textContent = ul.style.display === 'none' ? '📂' : '📁';
                });
                renderFileTree(item, ul, fullPath); 
            } else if (item) { 
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file';
                const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
                fileDiv.innerHTML = `${icon} ${key}`;
                li.appendChild(fileDiv);

                fileDiv.addEventListener('click', () => {
                    document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active'));
                    fileDiv.classList.add('active');
                    showViewer(item);
                });
            } else {
                console.warn(`在路徑 ${fullPath} 處發現一個非資料夾且沒有有效 item 的鍵: ${key}`);
                continue; 
            }
            parentElement.appendChild(li);
        }
    }

    // --- 4. 標籤渲染與排序 (renderTags, updateTagOrder) ---
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

    // --- 5. 搜尋與篩選邏輯 (applyFilters) ---
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
        
        const filteredTree = buildFileTree(filteredItems);
        renderFileTree(filteredTree);

        if (currentItem && !filteredItems.some(item => item.path === currentItem.path)) {
            hideViewer();
        }
    }
    searchInput.addEventListener('input', applyFilters);

    // --- 6. 右側檢視器功能 (showViewer, hideViewer, togglePin, updatePinButtonState) ---
    async function showViewer(item) {
        currentItem = item;
        viewerTitle.textContent = item.name;
        viewerContent.innerHTML = '';

        let contentHTML = '';
        const fileExtension = item.name.toLowerCase().split('.').pop();

        // 嘗試從 CacheManager 獲取快取內容
        let cachedContent = cacheManager.get(item.path);

        if (cachedContent) {
            contentHTML = cachedContent; // 直接使用快取內容
        } else {
            // 如果快取中沒有，則進行網路請求
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
                    // 將新獲取的內容存入快取 (預設 persistent=true，會存入 localStorage)
                    cacheManager.set(item.path, contentHTML);

                } else if (item.type === 'image') {
                    // 圖片直接使用 download_url，瀏覽器會自行處理圖片快取
                    contentHTML = `<img src="${item.download_url}" alt="${item.name}">`;
                    // 不快取圖片的 HTML 字符串，因為圖片資料本身由瀏覽器快取
                } else if (fileExtension === 'pdf') {
                    // --- 修正：PDF 使用 Google Docs Viewer 嵌入預覽 ---
                    contentHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(item.download_url)}&embedded=true" frameborder="0"></iframe>`;
                    // 不快取 PDF 的 HTML 字符串
                } else { // 處理未指定 type 但有預覽需求的檔案，或無法歸類的
                    contentHTML = `<p>檔案類型 "${item.type}" 或副檔名無法預覽。</p>`;
                    // 這些通用提示也可以快取
                    cacheManager.set(item.path, contentHTML);
                }

            } catch (error) {
                console.error('預覽內容載入失敗:', error);
                contentHTML = `<p style="color: red;">載入預覽內容失敗：${error.message}。請確認 ${item.path} 存在。</p>`;
                // 錯誤訊息也可以快取，避免重複失敗請求
                cacheManager.set(item.path, contentHTML, false); // 錯誤訊息可以只在 session 快取
            }
        }
        
        viewerContent.innerHTML = contentHTML;

        updatePinButtonState();
        viewerNewTabButton.href = item.download_url;

        rightPanelViewer.classList.add('active'); // 顯示右側檢視器
        contentDisplayArea.style.display = 'none'; // 隱藏佔位內容區
    }

    function hideViewer() {
        rightPanelViewer.classList.remove('active');
        currentItem = null;
        viewerContent.innerHTML = '';
        document.querySelectorAll('.file.active').forEach(el => el.classList.remove('active'));
        contentDisplayArea.style.display = 'flex'; // 顯示佔位內容區
    }

    viewerCloseButton.addEventListener('click', hideViewer);

    viewerPinButton.addEventListener('click', togglePin);

    function togglePin() {
        if (!currentItem) return;

        const isPinned = pinnedItems.some(p => p.path === currentItem.path);
        if (isPinned) {
            pinnedItems = pinnedItems.filter(p => p.path !== currentItem.path);
        } else {
            pinnedItems.push(currentItem);
        }

        localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
        updatePinButtonState();
    }

    function updatePinButtonState() {
        if (currentItem) {
            const isPinned = pinnedItems.some(p => p.path === currentItem.path);
            viewerPinButton.textContent = isPinned ? '★ 已釘選' : '★ 釘選';
        }
    }

    // --- 7. 網站啟動 ---
    initializeData();
});