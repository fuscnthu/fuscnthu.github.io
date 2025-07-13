// script.js
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
                    download_url: downloadUrl // 保持 download_url 一致性
                };
            });

            // 隱藏 'utils/' 資料夾下的檔案
            allItems = allItems.filter(item => !item.path.startsWith('utils/'));

            fileTreeData = buildFileTree(allItems);

            loadingMessage.style.display = 'none';
            renderTags();
            updatePinButtonState(); // 初始化時更新釘選按鈕狀態
            renderPinnedItems(); // 初始化時渲染釘選面板

            // 初始化時更新主佈局
            updateMainLayoutClass();

            // --- 新增的 URL Hash 處理邏輯 ---
            handleUrlHash(); // 處理初始 URL Hash
            window.addEventListener('hashchange', handleUrlHash); // 監聽 Hash 變化

        } catch (error) {
            console.error('初始化資料失敗:', error);
            // 載入失敗時，顯示錯誤訊息，但仍然嘗試導航到根目錄（儘管內容可能為空）
            loadingMessage.textContent = `載入資料失敗：${error.message}。請確保儲存庫公開，並 ${METADATA_FILE} 存在且格式正確。`;
            fileListContainer.innerHTML = ''; // 清空列表，因為沒有數據可顯示

            // 即使載入失敗，也要嘗試渲染麵包屑和主佈局，讓頁面結構正常
            currentPathParts = []; // 設置為根路徑
            currentDisplayTree = {}; // 清空顯示樹
            renderBreadcrumbs(); // 渲染根麵包屑
            updateMainLayoutClass(); // 更新佈局
        }
    }

    // --- 新增的 handleUrlHash 函數 ---
    function handleUrlHash() {
        const hash = window.location.hash; // 獲取當前的 URL Hash (例如: #/folder1/subfolder/)
        let pathFromHash = [];

        if (hash) {
            // 移除 # 符號，並以 / 分割路徑
            // 例如: #/原創角色/楊廣/ => ["", "原創角色", "楊廣", ""]
            // 濾掉空字串並解碼 URI component
            pathFromHash = hash.substring(1).split('/').filter(part => part !== '').map(decodeURIComponent);
        }

        // 如果 Hash 指定的是一個檔案路徑 (例如: #/folder/file.md)
        // 我們需要判斷最後一個部分是否是檔案，然後導航到其父資料夾並開啟檔案
        if (pathFromHash.length > 0) {
            const potentialFilePath = pathFromHash.join('/');
            const foundItem = allItems.find(item => item.path === potentialFilePath);
            if (foundItem) {
                // 如果是檔案，則導航到其父資料夾，然後打開該檔案
                const parentPathParts = pathFromHash.slice(0, -1);
                navigateTo(parentPathParts);
                // 等待 navigateTo 渲染完成，再嘗試開啟檔案，或者直接在 navigateTo 後打開
                // 這裡簡化處理，直接在導航後嘗試打開，因為 allItems 已經載入
                // 為了確保 showViewer 在 DOM 更新後執行，可以使用 setTimeout 稍微延遲
                // 但對於簡單的導航，直接呼叫通常也足夠
                setTimeout(() => {
                    showViewer(foundItem);
                    // 在文件列表中將選中的文件高亮
                    const fileElements = document.querySelectorAll('.file-item');
                    fileElements.forEach(el => {
                        const nameSpan = el.querySelector('.name');
                        if (nameSpan && nameSpan.textContent === foundItem.name) {
                            el.classList.add('active');
                        } else {
                            el.classList.remove('active');
                        }
                    });
                }, 50); // 短暫延遲
                return; // 處理完畢
            }
        }

        // 如果 Hash 指定的是資料夾路徑，或者 Hash 為空，則導航到該資料夾
        navigateTo(pathFromHash);
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
                folderDiv.innerHTML = `<span class="icon">📂</span> <span class="name">${key}</span>`; // 不顯示標籤
                li.appendChild(folderDiv);

                // 點擊資料夾進入下一層，並更新 URL Hash
                folderDiv.addEventListener('click', () => {
                    const newPathParts = [...currentPathParts, key];
                    window.location.hash = '/' + newPathParts.map(encodeURIComponent).join('/');
                    // navigateTo 函數會由 hashchange 事件觸發，因此這裡不再直接呼叫 navigateTo(newPathParts);
                });
            } else if (item) {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-item';
                const icon = item.type === 'image' ? '🖼️' : (item.name.toLowerCase().endsWith('.pdf') ? '📄' : (item.name.toLowerCase().endsWith('.docx') ? '📝' : '📜'));
                fileDiv.innerHTML = `<span class="icon">${icon}</span> <span class="name">${key}</span>`; // 不顯示標籤
                li.appendChild(fileDiv);

                // 點擊檔案顯示檢視器，並更新 URL Hash
                fileDiv.addEventListener('click', () => {
                    // document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
                    // fileDiv.classList.add('active'); // 由於 hashchange 會重新渲染，這裡先不直接加active
                    // showViewer(item); // 由於 hashchange 會觸發，這裡先不直接呼叫 showViewer
                    window.location.hash = '/' + item.path.split('/').map(encodeURIComponent).join('/');
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
            // 點擊麵包屑中的某一段，導航到該路徑，並更新 URL Hash
            pathSegmentButton.addEventListener('click', () => {
                const newPathParts = currentPathParts.slice(0, index + 1);
                window.location.hash = '/' + newPathParts.map(encodeURIComponent).join('/');
                // navigateTo 函數會由 hashchange 事件觸發
            });
            fileTreePathContainer.appendChild(pathSegmentButton);
        });
    }

    // --- 5. 導航到指定路徑 (此函數現在由 handleUrlHash 或直接點擊元素觸發) ---
    function navigateTo(pathArray) {
        currentItem = null; // 導航時清除當前選中的項目
        hideViewer(); // 導航時關閉檢視器
        document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active')); // 清除所有文件的高亮

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
                // 如果是 Hash 導航失敗，也更新 Hash 為根目錄
                if (window.location.hash !== '') {
                    window.location.hash = ''; // 將 URL hash 清空
                }
                break;
            }
        }
        currentDisplayTree = tempTree;
        renderCurrentLevel(currentDisplayTree); // 渲染當前層級內容
        renderBreadcrumbs(); // 更新麵包屑導覽
        updateMainLayoutClass(); // 更新主佈局
    }

    // 首頁按鈕事件監聽器，現在會更新 URL Hash
    homeButton.addEventListener('click', () => {
        window.location.hash = ''; // 清空 Hash，導航到根目錄
    });


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
        viewerContent.innerHTML = ''; // 清空之前的內容

        let contentElement; // 用於存放最終要顯示的 DOM 元素

        // 我們將不再直接緩存最終的 HTML 字符串，而是始終處理 Markdown 以正確應用 CSS 類別和移除 Frontmatter
        // 對於非 Markdown 文件，可以直接緩存最終 HTML 字符串

        try {
            if (item.type === 'document' && item.name.toLowerCase().endsWith('.md')) { // 處理 Markdown 文件
                const response = await fetch(item.download_url); // 使用 download_url
                if (!response.ok) throw new Error(`無法獲取內容: ${response.statusText}`);
                let rawContent = await response.text();

                let markdownContent = rawContent;
                let cssClassesToAdd = [];

                // Regex 查找 YAML Frontmatter
                const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/;
                const match = rawContent.match(frontmatterRegex);

                if (match) {
                    const frontmatterString = match[1]; // Frontmatter 內容
                    markdownContent = match[2].trim(); // 移除 Frontmatter 的 Markdown 內容

                    // 解析 Frontmatter 中的 cssclasses
                    const lines = frontmatterString.split('\n');
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('cssclasses:')) {
                            const classesPart = trimmedLine.split('cssclasses:')[1].trim();
                            if (classesPart.startsWith('-')) { // 列表格式: - class1, - class2
                                // 修正後的正則表達式，用於匹配列表項
                                const classListMatches = classesPart.matchAll(/-\s*([^\s-]+)/g);
                                for (const m of classListMatches) {
                                    cssClassesToAdd.push(m[1]);
                                }
                            } else { // 單行格式: cssclasses: class1 class2
                                cssClassesToAdd = classesPart.split(' ').map(c => c.trim()).filter(c => c.length > 0);
                            }
                            break;
                        }
                    }
                }

                contentElement = document.createElement('div');
                contentElement.classList.add('markdown-body');
                cssClassesToAdd.forEach(cls => contentElement.classList.add(cls));

                // 檢查 marked.parse 是否存在，並處理可能為空的內容
                if (typeof marked === 'undefined' || !marked.parse) {
                    console.error('Marked.js 庫未載入或不完整。無法解析 Markdown。');
                    contentElement.innerHTML = `<p style="color: red;">Marked.js 庫未載入，無法顯示 Markdown 內容。請檢查您的網路或 Marked CDN 連結。</p>`;
                } else if (!markdownContent) {
                     console.warn('Markdown 內容為空或無法獲取。');
                     contentElement.innerHTML = `<p style="color: red;">無法獲取 Markdown 內容或內容為空。</p>`;
                }
                else {
                    contentElement.innerHTML = marked.parse(markdownContent); // 渲染移除 Frontmatter 的 Markdown
                }
                cacheManager.set(item.path, contentElement.outerHTML); // 緩存最終的 HTML 字符串

            } else if (item.type === 'document' && item.name.toLowerCase().endsWith('.docx')) {
                contentElement = document.createElement('div');
                contentElement.innerHTML = `
                    <p style="text-align: center;">此為 Word 文件，無法直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
                cacheManager.set(item.path, contentElement.outerHTML);

            } else if (item.type === 'document' && item.name.toLowerCase().endsWith('.pdf')) {
                contentElement = document.createElement('iframe');
                contentElement.src = `https://docs.google.com/gview?url=${encodeURIComponent(item.download_url)}&embedded=true`; // 使用 download_url
                contentElement.frameBorder = "0";
                contentElement.width = "100%"; // 確保寬度佔滿
                contentElement.height = "600px"; // 確保高度
                cacheManager.set(item.path, contentElement.outerHTML);

            } else if (item.type === 'image') {
                contentElement = document.createElement('img');
                contentElement.src = item.download_url; // 使用 download_url
                contentElement.alt = item.name;

                // 檢查是否有描述並顯示
                if (item.description && item.description !== `沒有描述 - ${item.path}`) {
                    const descriptionElement = document.createElement('div');
                    descriptionElement.className = 'image-description'; // 添加一個 class 以便樣式化
                    viewerContent.appendChild(contentElement); // 先添加圖片
                    viewerContent.appendChild(descriptionElement); // 再添加描述
                    cacheManager.set(item.path, viewerContent.innerHTML); // 緩存整個內容
                    updatePinButtonState();
                    viewerNewTabButton.href = item.download_url;
                    rightPanelViewer.classList.add('active');
                    updateMainLayoutClass();
                    return; // 提前返回，因為已經手動添加了 contentElement
                }
                cacheManager.set(item.path, contentElement.outerHTML);

            } else if (item.type === 'document') { // 其他文檔類型 (非 md, docx, pdf)
                contentElement = document.createElement('div');
                contentElement.innerHTML = `
                    <p style="text-align: center;">檔案類型 ${item.name.toLowerCase().split('.').pop()} 不支援直接預覽。</p>
                    <a href="${item.download_url}" class="download-link" download="${item.name}">點此下載 ${item.name}</a>
                `;
                cacheManager.set(item.path, contentElement.outerHTML);

            } else { // 無法預覽的類型
                contentElement = document.createElement('p');
                contentElement.textContent = `檔案類型 "${item.type}" 或副檔名無法預覽。`;
                cacheManager.set(item.path, contentElement.outerHTML);
            }

        } catch (error) {
            console.error('預覽內容載入失敗:', error);
            contentElement = document.createElement('p');
            contentElement.style.color = 'red';
            contentElement.textContent = `載入預覽內容失敗：${error.message}。請確認 ${item.path} 存在。`;
            // 如果載入失敗，不將錯誤頁面緩存為有效內容
            cacheManager.set(item.path, contentElement.outerHTML, false);
        }

        if (contentElement) {
            viewerContent.appendChild(contentElement);
        }

        // 始終設置「在新分頁開啟」按鈕的 href
        viewerNewTabButton.href = item.download_url;


        updatePinButtonState(); // 更新釘選按鈕狀態
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
            viewerPinButton.classList.toggle('pinned', isPinned); // 動態添加/移除 'pinned' 類別
        } else {
            viewerPinButton.textContent = '★ 釘選'; // 沒有選中項目時顯示預設狀態
            viewerPinButton.classList.remove('pinned');
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
        // 標題欄始終置中且寬度為 80%
        document.body.classList.add('header-centered-80');

        if (currentItem === null) { // 沒有選中的檔案 (檢視器已關閉)
            document.body.classList.add('sidebar-expanded');
            document.body.classList.add('content-centered-80'); // 內容區（controls, sidebar）置中並佔80%寬
            contentDisplayArea.style.display = 'none'; // 隱藏佔位內容區
            document.body.classList.remove('viewer-active-layout'); // 移除選中後的佈局類別
            document.body.classList.remove('viewer-active');
        } else { // 有選中的檔案
            document.body.classList.remove('sidebar-expanded');
            document.body.classList.remove('content-centered-80'); // 移除置中類別
            if (rightPanelViewer.classList.contains('active')) {
                document.body.classList.add('viewer-active-layout'); // 選中且檢視器開啟時的佈局
                contentDisplayArea.style.display = 'none'; // 隱藏佔位內容區
                document.body.classList.add('viewer-active');
            } else { // 有選中檔案但檢視器未開啟 (可能剛關閉或尚未完全顯示)
                document.body.classList.remove('viewer-active-layout'); // 移除檢視器開啟時的佈局
                contentDisplayArea.style.display = 'flex'; // 顯示佔位內容區
                document.body.classList.remove('viewer-active');
            }
        }
    }


    // --- 11. 網站啟動 ---
    initializeData();
});