import { ipcMain, BrowserWindow } from "electron";
import { deleteItems } from "../modules/delete-files";
import type { Item } from "../types";
import { safeSendToWindow, handleError, createResponse } from "./utils";

export function registerDeleteHandlers(mainWindow: BrowserWindow) {
  // 先移除已存在的处理器，避免重复注册
  ipcMain.removeHandler("delete-files");

  // 处理删除文件请求
  ipcMain.handle("delete-files", async (event, items: Item[]) => {
    try {
      const results = await deleteItems(items);

      safeSendToWindow(mainWindow, "delete-files-result", { results });
      return createResponse(true, results);
    } catch (error) {
      const errorMessage = handleError(error);
      safeSendToWindow(mainWindow, "delete-files-error", {
        error: errorMessage,
      });
      return createResponse(false, undefined, errorMessage);
    }
  });
}
