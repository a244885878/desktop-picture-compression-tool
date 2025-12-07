import { app, BrowserWindow, dialog, shell } from "electron";
import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const isDev = !app.isPackaged;

// 获取 __dirname 的 ES 模块兼容方式
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局窗口引用
let mainWindow: BrowserWindow | null = null;

/**
 * 检查文件系统访问权限（macOS）
 * @returns Promise<boolean> 返回是否有权限
 */
async function checkFileSystemPermission(): Promise<boolean> {
  // 只在 macOS 上检查权限
  if (process.platform !== "darwin") {
    return true; // 非 macOS 系统默认返回 true
  }

  try {
    // 尝试访问用户桌面目录来检查权限
    const desktopPath = path.join(os.homedir(), "Desktop");
    await fs.access(desktopPath, fs.constants.R_OK);
    return true;
  } catch (error) {
    // 如果访问失败，可能是权限问题
    console.warn("File system permission check failed:", error);
    return false;
  }
}

/**
 * 显示权限请求对话框并打开系统设置
 */
async function requestFileSystemPermission(): Promise<void> {
  if (process.platform !== "darwin") {
    return; // 只在 macOS 上执行
  }

  // 确保 mainWindow 存在，如果不存在则使用无窗口模式
  const dialogOptions = {
    type: "warning" as const,
    title: "需要文件访问权限",
    message: "需要文件访问权限",
    detail:
      "应用需要访问您的文件系统才能正常工作。\n\n" +
      '请点击"打开系统设置"按钮，然后在"文件和文件夹"中授予应用访问权限。\n\n' +
      "授权后，请重新启动应用。",
    buttons: ["打开系统设置", "稍后提醒"],
    defaultId: 0,
    cancelId: 1,
  };

  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);

  if (result.response === 0) {
    // 打开 macOS 系统设置的隐私与安全性页面
    // 尝试多种方式以确保在不同版本的 macOS 上都能正常工作
    const urls = [
      // macOS 13+ (Ventura+) 使用新的系统设置 URL
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
      // macOS 12 及更早版本使用旧的系统偏好设置 URL
      "x-apple.systempreferences:com.apple.preference.security?Privacy",
      // 通用系统设置 URL
      "x-apple.systempreferences:com.apple.preference.security",
    ];

    let opened = false;
    for (const url of urls) {
      try {
        await shell.openExternal(url);
        opened = true;
        break;
      } catch (error) {
        console.warn(`Failed to open system settings with URL: ${url}`, error);
        continue;
      }
    }

    if (!opened) {
      console.error("Failed to open system settings with all attempted URLs");
    }
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // 用 preload 通信
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // 启用 ES 模块支持
      sandbox: false,
    },
  });

  // 设置安全的 Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;",
          ],
        },
      });
    }
  );

  mainWindow.removeMenu(); // 隐藏顶部菜单栏

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：在打包后，文件会被打包到 app.asar 中
    // __dirname 指向 app.asar/dist-electron/，所以使用相对路径加载 HTML
    const htmlPath = path.join(__dirname, "../dist/index.html");

    mainWindow.loadFile(htmlPath).catch((err) => {
      console.error("Failed to load HTML file:", err);
      console.error("Attempted path:", htmlPath);
      console.error("__dirname:", __dirname);
      console.error("app.getAppPath():", app.getAppPath());

      // 备用方案：使用 app.getAppPath()
      const appPath = app.getAppPath();
      const alternativePath = path.join(appPath, "dist", "index.html");
      console.log("Trying alternative path:", alternativePath);
      return mainWindow!.loadFile(alternativePath).catch((altErr) => {
        console.error("Alternative path also failed:", altErr);
        throw altErr;
      });
    });
  }
};

app.whenReady().then(async () => {
  // 检查文件系统权限
  const hasPermission = await checkFileSystemPermission();

  if (!hasPermission) {
    // 如果没有权限，先创建窗口（用于显示对话框）
    createWindow();
    // 等待窗口准备好后再显示对话框
    if (mainWindow) {
      mainWindow.once("ready-to-show", async () => {
        await requestFileSystemPermission();
      });
    } else {
      await requestFileSystemPermission();
    }
  } else {
    // 有权限，正常创建窗口
    createWindow();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // 每次激活时也检查权限
      const hasPermission = await checkFileSystemPermission();
      if (!hasPermission) {
        createWindow();
        if (mainWindow) {
          mainWindow.once("ready-to-show", async () => {
            await requestFileSystemPermission();
          });
        } else {
          await requestFileSystemPermission();
        }
      } else {
        createWindow();
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
