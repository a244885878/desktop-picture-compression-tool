import { ipcMain, BrowserWindow } from "electron";
import { getDirectoryData } from "../modules/get-directory-data";
import { safeSendToWindow, handleError } from "./utils";

export function registerDirectoryHandlers(mainWindow: BrowserWindow) {
  // 注册IPC处理器（只注册一次）
  ipcMain.on("get-directory-data", (event, path: string) => {
    try {
      const { breadcrumb, items } = getDirectoryData(path);
      safeSendToWindow(mainWindow, "directory-data", { breadcrumb, items });
    } catch (error) {
      const errorMessage = handleError(error);
      safeSendToWindow(mainWindow, "directory-data-error", {
        error: errorMessage,
      });
    }
  });
}
