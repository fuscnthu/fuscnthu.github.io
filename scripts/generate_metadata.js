const fs = require('fs');
const path = require('path'); // Node.js 內建的 path 模組

const IGNORE_DIRS = ['.git', 'node_modules', '.github', 'scripts'];
const IGNORE_FILES = ['.DS_Store', 'metadata.json', 'README.md', 'LICENSE', 'index.html', 'style.css', 'script.js', 'package.json', 'package-lock.json'];

const OUTPUT_FILE = 'metadata.json'; // 輸出檔案名稱
const TARGET_DIR = '.'; // 要掃描的目標目錄 (這裡表示儲存庫根目錄)

let existingMetadata = {}; // 用於儲存現有的 metadata，方便查詢

// 嘗試讀取現有的 metadata.json
try {
    if (fs.existsSync(OUTPUT_FILE)) {
        const rawData = fs.readFileSync(OUTPUT_FILE);
        const parsedData = JSON.parse(rawData);
        // 將現有 metadata 轉換成以 path 為鍵的物件，方便快速查詢
        parsedData.forEach(item => {
            existingMetadata[item.path] = item;
        });
        console.log(`Loaded ${Object.keys(existingMetadata).length} existing entries from ${OUTPUT_FILE}`);
    }
} catch (error) {
    console.error(`Error loading existing metadata.json: ${error.message}`);
    existingMetadata = {}; // 如果讀取失敗，則清空，避免影響後續操作
}


const metadata = [];

// 遞迴函數：掃描目錄並收集檔案資訊
function collectFiles(currentPath) {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
        const fullPath = path.join(currentPath, file);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            const dirName = path.basename(fullPath);
            if (!IGNORE_DIRS.includes(dirName)) {
                collectFiles(fullPath); // 遞迴進入子資料夾
            }
        } else if (stats.isFile()) {
            const fileName = path.basename(fullPath);
            if (!IGNORE_FILES.includes(fileName)) {
                const relativePath = path.relative(TARGET_DIR, fullPath).replace(/\\/g, '/'); // 確保路徑是 / 分隔

                let type = 'document'; // 預設為 document
                const ext = path.extname(fileName).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
                    type = 'image';
                }

                // --- Start: 自動生成標籤邏輯 ---
                let generatedTags = []; // 儲存腳本自動生成的標籤
                const pathParts = relativePath.split('/');
                if (pathParts.length > 1) {
                    const folderTag = pathParts[pathParts.length - 2];
                    if (folderTag && !['assets', 'docs', 'images', 'test-folder'].includes(folderTag.toLowerCase())) {
                        generatedTags.push(folderTag);
                    }
                }
                if (fileName.toLowerCase().includes('report')) generatedTags.push('報告');
                if (fileName.toLowerCase().includes('plan')) generatedTags.push('規劃');
                if (fileName.toLowerCase().includes('design')) generatedTags.push('設計');
                if (fileName.toLowerCase().includes('overview') || fileName.toLowerCase().includes('summary')) generatedTags.push('概述');
                if (fileName.toLowerCase().includes('image') || type === 'image') generatedTags.push('圖片');
                if (fileName.toLowerCase().includes('document') || type === 'document') generatedTags.push('文件');
                if (fileName.toLowerCase().endsWith('.docx')) generatedTags.push('Word');

                // 去重
                generatedTags = [...new Set(generatedTags)];
                // --- End: 自動生成標籤邏輯 ---


                // 檢查是否已存在於現有 metadata 中，並保留描述和標籤
                let description = `關於 ${fileName} 的簡要說明。`; // 預設描述
                let finalTags = generatedTags; // 預設使用自動生成的標籤

                if (existingMetadata[relativePath]) {
                    // 如果存在，且描述不為空，且不是預設的簡要說明，則保留現有描述
                    if (existingMetadata[relativePath].description &&
                        existingMetadata[relativePath].description !== `關於 ${fileName} 的簡要說明。`) {
                        description = existingMetadata[relativePath].description;
                    }

                    // 如果現有 metadata 有 tags 且不為空，則保留現有的 tags
                    // 這就是新增的邏輯，用於防止覆寫
                    if (existingMetadata[relativePath].tags && existingMetadata[relativePath].tags.length > 0) {
                        finalTags = existingMetadata[relativePath].tags;
                    }
                }

                metadata.push({
                    path: relativePath,
                    type: type,
                    tags: finalTags, // 使用最終決定的標籤 (可能是現有的，也可能是自動生成的)
                    description: description
                });
            }
        }
    }
}

// 執行掃描
collectFiles(TARGET_DIR);

// 寫入 metadata.json
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 4));

console.log(`Successfully generated ${metadata.length} entries into ${OUTPUT_FILE}`);