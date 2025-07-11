const fs = require('fs');
const path = require('path'); // Node.js 內建的 path 模組

const IGNORE_DIRS = ['.git', 'node_modules', '.github', 'scripts']; // 忽略這些資料夾
const IGNORE_FILES = ['.DS_Store', 'metadata.json', 'README.md', 'LICENSE']; // 忽略這些檔案

const OUTPUT_FILE = 'metadata.json'; // 輸出檔案名稱
const TARGET_DIR = '.'; // 要掃描的目標目錄 (這裡表示儲存庫根目錄)

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

                // 根據副檔名自動判斷 type
                let type = 'document'; // 預設為 document
                const ext = path.extname(fileName).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
                    type = 'image';
                }

                // 嘗試根據路徑或檔名自動生成標籤 (這是一個範例，您可以自訂規則)
                let tags = [];
                const pathParts = relativePath.split('/');
                if (pathParts.length > 1) {
                    // 將資料夾名稱作為標籤
                    const folderTag = pathParts[pathParts.length - 2];
                    if (folderTag && !['assets', 'docs', 'images'].includes(folderTag.toLowerCase())) { // 排除通用資料夾名
                        tags.push(folderTag);
                    }
                }
                // 根據檔名包含的關鍵字添加標籤
                if (fileName.toLowerCase().includes('report')) tags.push('報告');
                if (fileName.toLowerCase().includes('plan')) tags.push('規劃');
                if (fileName.toLowerCase().includes('design')) tags.push('設計');
                if (fileName.toLowerCase().includes('overview') || fileName.toLowerCase().includes('summary')) tags.push('概述');
                if (fileName.toLowerCase().includes('image') || type === 'image') tags.push('圖片');
                if (fileName.toLowerCase().includes('document') || type === 'document') tags.push('文件');
                
                // 去重標籤
                tags = [...new Set(tags)];


                metadata.push({
                    path: relativePath,
                    type: type,
                    tags: tags,
                    description: `關於 ${fileName} 的簡要說明。` // 預設描述，您可以手動在 metadata.json 編輯（但下次自動生成會覆蓋）
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