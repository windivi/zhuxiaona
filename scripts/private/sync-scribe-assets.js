const Path = require('path');
const FileSystem = require('fs');

const sourceDir = Path.join(__dirname, '..', '..', 'node_modules', 'scribe.js-ocr');
const targetDir = Path.join(__dirname, '..', '..', 'build', 'public', 'vendor', 'scribe.js-ocr');

function syncScribeAssets() {
    if (!FileSystem.existsSync(sourceDir)) {
        throw new Error(`Missing Scribe package at ${sourceDir}`);
    }

    FileSystem.rmSync(targetDir, {
        recursive: true,
        force: true,
    });
    FileSystem.mkdirSync(Path.dirname(targetDir), { recursive: true });
    FileSystem.cpSync(sourceDir, targetDir, { recursive: true });
}

module.exports = syncScribeAssets;