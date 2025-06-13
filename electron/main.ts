import { app, BrowserWindow } from "electron";
import * as path from "path";
import { ipcMain } from "electron";
import { getSystemPaths } from "./modules/get-disk-drive-letters";

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

  // 加载完成获取系统盘符列表
  win.webContents.on("did-finish-load", () => {
    const paths = getSystemPaths();
    win.webContents.send("system-paths", paths);
  });

  // 监听渲染进程的消息
  ipcMain.on("message", (event, msg) => {
    console.log(msg);
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
