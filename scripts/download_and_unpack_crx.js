/**
 * 简单脚本：下载 CRX 并尝试解包
 * 用法: node scripts/download_and_unpack_crx.js <extensionId> [outputDir]
 *
 * 说明：脚本会把 crx 下载为 outputDir/<id>.crx，查找 ZIP header 并写为 <id>.zip，
 * 然后若本机有 `unzip` 命令，会尝试自动解压到 outputDir/<id>/。
 * 如果没有 unzip，请手动用 7zip 或其它工具解压 <id>.zip。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function downloadCrx(id, outDir) {
    return new Promise((resolve, reject) => {
        const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=116.0&x=id%3D${id}%26uc`;
        const outCrx = path.join(outDir, `${id}.crx`);
        const file = fs.createWriteStream(outCrx);
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // follow redirect
                https.get(res.headers.location, (r2) => {
                    r2.pipe(file);
                    r2.on('end', () => resolve(outCrx));
                }).on('error', reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error('Failed to download CRX, status: ' + res.statusCode));
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(outCrx)));
        }).on('error', (e) => reject(e));
    });
}

function extractZipFromCrx(crxPath, outDir) {
    const buf = fs.readFileSync(crxPath);
    // 查找 PK ZIP header
    const pk = Buffer.from([0x50,0x4b,0x03,0x04]);
    const idx = buf.indexOf(pk);
    if (idx === -1) throw new Error('ZIP header not found in crx');
    const zipBuf = buf.slice(idx);
    const zipPath = path.join(outDir, path.basename(crxPath, '.crx') + '.zip');
    fs.writeFileSync(zipPath, zipBuf);
    return zipPath;
}

async function main() {
    const id = process.argv[2];
    const outDir = process.argv[3] ? process.argv[3] : path.join(process.cwd(), 'extensions');
    if (!id) {
        console.error('Usage: node scripts/download_and_unpack_crx.js <extensionId> [outputDir]');
        process.exit(2);
    }
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    try {
        console.log('Downloading CRX for', id);
        const crx = await downloadCrx(id, outDir);
        console.log('Saved CRX to', crx);
        console.log('Extracting zip portion...');
        const zipPath = extractZipFromCrx(crx, outDir);
        console.log('Wrote zip to', zipPath);
        // 尝试用 unzip 解压
        const targetDir = path.join(outDir, id);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
        exec(`unzip -o "${zipPath}" -d "${targetDir}"`, (err, stdout, stderr) => {
            if (err) {
                console.warn('unzip not available or failed. You can manually extract', zipPath, 'to', targetDir);
                console.warn('stderr:', stderr);
                console.log('If you are on Windows, use 7zip or Explorer to extract the zip file.');
            } else {
                console.log('Extracted extension to', targetDir);
            }
        });
    } catch (e) {
        console.error('Error:', e && e.message ? e.message : e);
        process.exit(1);
    }
}

if (require.main === module) main();
