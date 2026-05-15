const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const compileTs = require('./private/tsc');
const syncScribeAssets = require('./private/sync-scribe-assets');

const buildDir = Path.join(__dirname, '..', 'build');
const rendererIndexPath = Path.join(buildDir, 'renderer', 'index.html');

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

async function main() {
    FileSystem.rmSync(buildDir, {
        recursive: true,
        force: true,
    });

    console.log(Chalk.blueBright('Transpiling renderer & main...'));

    syncScribeAssets();

    await Promise.all([
        buildRenderer(),
        buildMain(),
    ]);

    if (!FileSystem.existsSync(rendererIndexPath)) {
        throw new Error(`Renderer output is missing: ${rendererIndexPath}`);
    }

    console.log(Chalk.greenBright('Renderer & main successfully transpiled! (ready to be built with electron-builder)'));
}

main().catch((error) => {
    console.error(Chalk.redBright('Renderer or main build failed.'));
    console.error(error);
    process.exitCode = 1;
});
