const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const compileTs = require('./private/tsc');

// 设置 electron-builder 的阿里云镜像
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://registry.npmmirror.com/-/raw/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://registry.npmmirror.com/-/raw/electron-builder-binaries/';

console.log(Chalk.cyan('Electron Mirror:', process.env.ELECTRON_MIRROR));
console.log(Chalk.cyan('Electron Builder Binaries Mirror:', process.env.ELECTRON_BUILDER_BINARIES_MIRROR));

function buildRenderer() {
    return Vite.build({
        configFile: Path.join(__dirname, '..', 'vite.config.js'),
        base: './',
        mode: 'production'
    });
}

function buildMain() {
    const mainPath = Path.join(__dirname, '..', 'src', 'main');
    return compileTs(mainPath);
}

FileSystem.rmSync(Path.join(__dirname, '..', 'build'), {
    recursive: true,
    force: true,
})

console.log(Chalk.blueBright('Transpiling renderer & main...'));

Promise.allSettled([
    buildRenderer(),
    buildMain(),
]).then(() => {
    console.log(Chalk.greenBright('Renderer & main successfully transpiled! (ready to be built with electron-builder)'));
});
