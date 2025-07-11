// 快取管理器 - 使用瀏覽器儲存機制減少 GitHub API 請求
export class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.storagePrefix = 'github_file_browser_';
        this.cacheVersion = '1.0'; // 快取版本，用於無效化舊版本快取
        this.maxMemoryCacheSize = 50; // 記憶體快取最大項目數
        this.maxStorageCacheSize = 200; // localStorage/sessionStorage 快取最大項目數
        this.cacheExpireTime = 30 * 60 * 1000; // 30分鐘過期 (毫秒)

        // 初始化時清理過期的快取
        this.cleanExpiredCache();
    }

    /**
     * 生成快取鍵值
     * @param {string} path 路徑
     * @returns {string} 快取鍵值
     */
    getCacheKey(path) {
        // 將路徑中的 '/' 和 '\' 替換為 '_'，以確保鍵名有效且唯一
        return `${this.storagePrefix}${path.replace(/[\/\\]/g, '_')}`;
    }

    /**
     * 從快取中獲取資料
     * @param {string} path 路徑
     * @returns {Object|null} 快取的資料或 null
     */
    get(path) {
        const cacheKey = this.getCacheKey(path);

        // 1. 先檢查記憶體快取
        if (this.memoryCache.has(cacheKey)) {
            const cached = this.memoryCache.get(cacheKey);
            if (this.isValidCache(cached)) {
                console.log('從記憶體快取載入:', path);
                return cached.data;
            } else {
                this.memoryCache.delete(cacheKey); // 過期則刪除
            }
        }

        // 2. 檢查 localStorage (持久化儲存)
        try {
            const stored = localStorage.getItem(cacheKey);
            if (stored) {
                const cached = JSON.parse(stored);
                if (this.isValidCache(cached)) {
                    // 將資料載入到記憶體快取，以便下次更快存取
                    this.memoryCache.set(cacheKey, cached);
                    this.manageMemoryCacheSize();
                    console.log('從 localStorage 載入:', path);
                    return cached.data;
                } else {
                    localStorage.removeItem(cacheKey); // 過期或無效則刪除
                }
            }
        } catch (error) {
            console.warn('讀取 localStorage 快取失敗:', error);
            // 如果解析失敗，也應該清除破損的項目
            localStorage.removeItem(cacheKey);
        }

        // 3. 檢查 sessionStorage (會話儲存)
        try {
            const stored = sessionStorage.getItem(cacheKey);
            if (stored) {
                const cached = JSON.parse(stored);
                if (this.isValidCache(cached)) {
                    // 將資料載入到記憶體快取
                    this.memoryCache.set(cacheKey, cached);
                    this.manageMemoryCacheSize();
                    console.log('從 sessionStorage 載入:', path);
                    return cached.data;
                } else {
                    sessionStorage.removeItem(cacheKey); // 過期或無效則刪除
                }
            }
        } catch (error) {
            console.warn('讀取 sessionStorage 快取失敗:', error);
            // 如果解析失敗，也應該清除破損的項目
            sessionStorage.removeItem(cacheKey);
        }

        return null; // 快取中沒有找到有效資料
    }

    /**
     * 將資料存入快取
     * @param {string} path 路徑
     * @param {Object} data 要快取的資料 (通常是預覽的 HTML 字符串)
     * @param {boolean} persistent 是否持久化到 localStorage (預設為 true)
     */
    set(path, data, persistent = true) {
        const cacheKey = this.getCacheKey(path);
        const cacheItem = {
            data: data,
            timestamp: Date.now(),
            version: this.cacheVersion, // 記錄快取版本
            path: path // 記錄原始路徑，方便管理
        };

        // 存入記憶體快取
        this.memoryCache.set(cacheKey, cacheItem);
        this.manageMemoryCacheSize(); // 管理記憶體快取大小

        // 存入瀏覽器儲存 (localStorage 或 sessionStorage)
        try {
            const serialized = JSON.stringify(cacheItem);

            if (persistent) {
                // 嘗試存入 localStorage (持久化)
                try {
                    localStorage.setItem(cacheKey, serialized);
                    this.manageStorageCacheSize('localStorage');
                    console.log('資料已快取到 localStorage:', path);
                } catch (error) {
                    // 如果 localStorage 空間不足或寫入失敗，降級使用 sessionStorage
                    console.warn('localStorage 儲存失敗，改用 sessionStorage:', error);
                    sessionStorage.setItem(cacheKey, serialized);
                    this.manageStorageCacheSize('sessionStorage'); // 也管理 sessionStorage 大小
                }
            } else {
                // 存入 sessionStorage (分頁期間)
                sessionStorage.setItem(cacheKey, serialized);
                this.manageStorageCacheSize('sessionStorage');
                console.log('資料已快取到 sessionStorage:', path);
            }
        } catch (error) {
            console.warn('快取儲存失敗 (可能是資料過大或序列化問題):', error);
        }
    }

    /**
     * 檢查快取項目是否有效 (未過期且版本匹配)
     * @param {Object} cached 快取項目
     * @returns {boolean} 是否有效
     */
    isValidCache(cached) {
        if (!cached || !cached.timestamp || !cached.version || cached.data === undefined) {
            return false; // 缺少必要屬性
        }

        // 檢查快取版本是否匹配，用於強制更新舊版本快取
        if (cached.version !== this.cacheVersion) {
            console.log(`快取版本不匹配，捨棄舊快取: ${cached.path} (v${cached.version} vs v${this.cacheVersion})`);
            return false;
        }

        // 檢查是否過期
        const now = Date.now();
        return (now - cached.timestamp) < this.cacheExpireTime;
    }

    /**
     * 管理記憶體快取大小 (LRU 策略)
     */
    manageMemoryCacheSize() {
        // 如果記憶體快取超出最大限制，移除最舊的項目 (Map 的迭代順序是插入順序)
        while (this.memoryCache.size > this.maxMemoryCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
    }

    /**
     * 管理儲存快取大小 (localStorage 或 sessionStorage)
     * @param {string} storageType 儲存類型 'localStorage' 或 'sessionStorage'
     */
    manageStorageCacheSize(storageType = 'localStorage') {
        try {
            const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
            const relevantKeys = [];

            // 收集所有相關的快取鍵值及其時間戳
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(this.storagePrefix)) {
                    try {
                        const item = JSON.parse(storage.getItem(key));
                        // 確保是有效的快取結構，否則直接刪除
                        if (item && item.timestamp !== undefined) {
                            relevantKeys.push({ key, timestamp: item.timestamp });
                        } else {
                            storage.removeItem(key); // 無效結構的快取
                        }
                    } catch (error) {
                        console.warn(`解析儲存快取項目失敗 (${key})，已刪除:`, error);
                        storage.removeItem(key); // 解析失敗的快取
                    }
                }
            }

            // 如果超過限制，刪除最舊的項目
            if (relevantKeys.length > this.maxStorageCacheSize) {
                relevantKeys.sort((a, b) => a.timestamp - b.timestamp); // 按時間戳排序 (最舊的在前)
                const toDelete = relevantKeys.slice(0, relevantKeys.length - this.maxStorageCacheSize);
                toDelete.forEach(item => storage.removeItem(item.key));
                console.log(`清理了 ${toDelete.length} 個舊的 ${storageType} 快取項目`);
            }
        } catch (error) {
            console.warn(`管理 ${storageType} 快取大小失敗:`, error);
        }
    }

    /**
     * 清理所有過期的快取 (在初始化時執行一次)
     */
    cleanExpiredCache() {
        const storageTypes = [localStorage, sessionStorage];

        storageTypes.forEach(storage => {
            try {
                const keysToDelete = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key && key.startsWith(this.storagePrefix)) {
                        try {
                            const item = JSON.parse(storage.getItem(key));
                            if (!this.isValidCache(item)) { // 如果無效 (過期或版本不符或結構錯誤)
                                keysToDelete.push(key);
                            }
                        } catch (error) {
                            keysToDelete.push(key); // 解析失敗的也刪除
                        }
                    }
                }
                keysToDelete.forEach(key => storage.removeItem(key));
                if (keysToDelete.length > 0) {
                    console.log(`清理了 ${keysToDelete.length} 個過期的 ${storage.constructor.name} 快取項目`);
                }
            } catch (error) {
                console.warn(`清理過期快取失敗 (${storage.constructor.name}):`, error);
            }
        });
    }

    /**
     * 清除所有快取 (用於開發或除錯)
     */
    clearAll() {
        this.memoryCache.clear(); // 清除記憶體快取

        // 清除瀏覽器儲存快取 (只清除我們自己的快取)
        const storageTypes = [localStorage, sessionStorage];
        storageTypes.forEach(storage => {
            try {
                const keysToDelete = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key && key.startsWith(this.storagePrefix)) {
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(key => storage.removeItem(key));
            } catch (error) {
                console.warn('清除儲存快取失敗:', error);
            }
        });

        console.log('所有快取已清除');
    }

    /**
     * 刪除特定路徑的快取
     * @param {string} path 路徑
     */
    delete(path) {
        const cacheKey = this.getCacheKey(path);
        this.memoryCache.delete(cacheKey);
        try {
            localStorage.removeItem(cacheKey);
            sessionStorage.removeItem(cacheKey);
        } catch (error) {
            console.warn('刪除特定儲存快取失敗:', error);
        }
    }

    /**
     * 獲取快取狀態 (用於除錯或顯示)
     * @returns {Object} 快取狀態資訊
     */
    getStatus() {
        const memorySize = this.memoryCache.size;
        let localStorageSize = 0;
        let sessionStorageSize = 0;

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.storagePrefix)) {
                    localStorageSize++;
                }
            }
        } catch (error) { /* ignored */ }

        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(this.storagePrefix)) {
                    sessionStorageSize++;
                }
            }
        } catch (error) { /* ignored */ }

        return {
            memory: {
                size: memorySize,
                maxSize: this.maxMemoryCacheSize
            },
            localStorage: {
                size: localStorageSize,
                maxSize: this.maxStorageCacheSize
            },
            sessionStorage: {
                size: sessionStorageSize
            },
            cacheExpireTime: this.cacheExpireTime,
            version: this.cacheVersion
        };
    }

    /**
     * 預載入常用路徑 (此處僅為骨架，需與實際資料載入邏輯結合)
     * @param {Array<string>} paths 路徑陣列
     */
    async preloadPaths(paths) {
        console.log('開始預載入常用路徑...');
        for (const path of paths) {
            if (!this.get(path)) {
                // 這裡應該呼叫實際獲取內容並存入快取的函數
                console.log(`需要預載入但未快取: ${path}`);
                // 例如：await fetchContentAndCache(path);
            } else {
                console.log(`已從快取載入預載入項目: ${path}`);
            }
        }
    }
}