import { BrowserWindow } from "electron";
import { registerDirectoryHandlers } from "./directory-handlers";
import { registerCompressionHandlers } from "./compression-handlers";
import { registerDeleteHandlers } from "./delete-handlers";

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // 注册所有IPC处理器
  registerDirectoryHandlers(mainWindow);
  registerCompressionHandlers(mainWindow);
  registerDeleteHandlers(mainWindow);
}
