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

                let tags = [];
                const pathParts = relativePath.split('/');
                if (pathParts.length > 1) {
                    const folderTag = pathParts[pathParts.length - 2];
                    if (folderTag && !['assets', 'docs', 'images', 'test-folder'].includes(folderTag.toLowerCase())) {
                        tags.push(folderTag);
                    }
                }
                if (fileName.toLowerCase().includes('report')) tags.push('報告');
                if (fileName.toLowerCase().includes('plan')) tags.push('規劃');
                if (fileName.toLowerCase().includes('design')) tags.push('設計');
                if (fileName.toLowerCase().includes('overview') || fileName.toLowerCase().includes('summary')) tags.push('概述');
                if (fileName.toLowerCase().includes('image') || type === 'image') tags.push('圖片');
                if (fileName.toLowerCase().includes('document') || type === 'document') tags.push('文件');
                if (fileName.toLowerCase().endsWith('.docx')) tags.push('Word');

                tags = [...new Set(tags)];

                // 檢查是否已存在於現有 metadata 中，並保留描述
                let description = `關於 ${fileName} 的簡要說明。`; // 預設描述
                if (existingMetadata[relativePath] && existingMetadata[relativePath].description && 
                    existingMetadata[relativePath].description !== `關於 ${fileName} 的簡要說明。`) {
                    // 如果存在，且描述不為空，且不是預設的簡要說明，則保留
                    description = existingMetadata[relativePath].description;
                }

                metadata.push({
                    path: relativePath,
                    type: type,
                    tags: tags,
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