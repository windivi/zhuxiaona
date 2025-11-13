const ChildProcess = require('child_process');
const Chalk = require('chalk');

function compile(directory) {
  return new Promise((resolve, reject) => {
    // 使用 npx 来运行 tsc，确保能找到 node_modules 中的 tsc
    const tscProcess = ChildProcess.exec('npx tsc', {
      cwd: directory,
      maxBuffer: 10 * 1024 * 1024 // 增加 buffer 大小到 10MB
    });

    tscProcess.stdout.on('data', data => 
        process.stdout.write(Chalk.yellowBright(`[tsc] `) + Chalk.white(data.toString()))
    );

    tscProcess.stderr.on('data', data => 
        process.stderr.write(Chalk.redBright(`[tsc] `) + Chalk.white(data.toString()))
    );

    tscProcess.on('exit', exitCode => {
      if (exitCode > 0) {
        reject(exitCode);
      } else {
        resolve();
      }
    });

    tscProcess.on('error', (error) => {
      console.error(Chalk.redBright('[tsc] 执行错误:'), error.message);
      reject(error);
    });
  });
}

module.exports = compile;
