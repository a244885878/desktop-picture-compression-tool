import { app, BrowserWindow } from "electron";
import * as path from "path";
import { ipcMain } from "electron";
import { getDirectoryData } from "./modules/get-directory-data";

const isDev = !app.isPackaged;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // 用 preload 通信
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.removeMenu(); // 隐藏顶部菜单栏

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    win.loadURL(VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // 加载完成获取根目录数据
  win.webContents.on("did-finish-load", () => {
    const { breadcrumb, items } = getDirectoryData();
    win.webContents.send("directory-data", { breadcrumb, items });
  });

  // 收到渲染进程需要获取目录数据的消息
  ipcMain.on("get-directory-data", (event, path: string) => {
    try {
      const { breadcrumb, items } = getDirectoryData(path);
      // 检查窗口是否还存在
      if (!win.isDestroyed()) {
        win.webContents.send("directory-data", { breadcrumb, items });
      }
    } catch (error) {
      console.error("获取目录数据失败:", error);
      // 如果出错，发送错误信息给渲染进程
      if (!win.isDestroyed()) {
        win.webContents.send("directory-data-error", {
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
    }
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
