import { app, BrowserWindow } from "electron";
import * as path from "path";
import { getDirectoryData } from "./modules/get-directory-data";
import { registerIpcHandlers } from "./ipc-handlers";

const isDev = !app.isPackaged;

// 全局窗口引用
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // 用 preload 通信
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.removeMenu(); // 隐藏顶部菜单栏

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // 注册所有IPC处理器
  registerIpcHandlers(mainWindow);

  // 加载完成获取根目录数据
  mainWindow.webContents.on("did-finish-load", () => {
    const { breadcrumb, items } = getDirectoryData();
    mainWindow!.webContents.send("directory-data", { breadcrumb, items });
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
