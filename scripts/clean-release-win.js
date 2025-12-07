// 只在 Windows 上清理 release 目录
if (process.platform !== 'win32') {
  console.log('非 Windows 系统，跳过清理');
  process.exit(0);
}

const fs = require('fs');
const path = require('path');

const releaseDir = path.join(process.cwd(), 'release');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeDir(dirPath, retries = 5) {
  if (!fs.existsSync(dirPath)) {
    console.log('Release 目录不存在，跳过清理');
    return;
  }

  console.log('开始清理 release 目录（Windows）...');

  for (let i = 0; i < retries; i++) {
    try {
      // 使用 Node.js 14+ 的 fs.rmSync
      if (fs.rmSync) {
        try {
          fs.rmSync(dirPath, { 
            recursive: true, 
            force: true,
            maxRetries: 3,
            retryDelay: 500
          });
        } catch (err) {
          // 如果 rmSync 失败，回退到手动删除
          throw err;
        }
      } else {
        // 旧版本 Node.js 的回退方案
        const deleteRecursive = (dir) => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((file) => {
              const curPath = path.join(dir, file);
              try {
                if (fs.lstatSync(curPath).isDirectory()) {
                  deleteRecursive(curPath);
                } else {
                  // 在 Windows 上，先移除只读属性
                  try {
                    fs.chmodSync(curPath, 0o666);
                  } catch {
                    // 忽略 chmod 错误
                  }
                  fs.unlinkSync(curPath);
                }
              } catch (err) {
                // 忽略单个文件的删除错误，继续尝试
              }
            });
            try {
              fs.rmdirSync(dir);
            } catch {
              // 如果目录不为空，忽略错误
            }
          }
        };
        deleteRecursive(dirPath);
      }
      
      // 验证是否删除成功
      if (!fs.existsSync(dirPath)) {
        console.log('✓ Release 目录清理成功');
        return;
      }
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`清理尝试 ${i + 1}/${retries} 失败，${err.message}，等待后重试...`);
        await sleep(1000 * (i + 1)); // 递增延迟
      } else {
        console.warn(`清理尝试 ${i + 1}/${retries} 失败: ${err.message}`);
      }
    }
  }

  // 如果所有重试都失败，给出警告但继续构建
  if (fs.existsSync(dirPath)) {
    console.warn('⚠ 警告: 无法完全清理 release 目录，某些文件可能被占用');
    console.warn('   建议:');
    console.warn('   1. 关闭可能占用文件的程序（如文件管理器、杀毒软件等）');
    console.warn('   2. 手动删除 release 目录后重试');
    console.warn('   构建将继续，但可能会失败...\n');
  }
}

removeDir(releaseDir).catch(err => {
  console.error('清理脚本执行出错:', err);
  console.warn('清理失败，但将继续构建过程...\n');
});

