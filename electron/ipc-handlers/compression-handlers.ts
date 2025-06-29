import { ipcMain, BrowserWindow } from "electron";
import { compressImages } from "../modules/compress-pictures";
import type { ImageItem } from "../types";
import { safeSendToWindow, handleError } from "./utils";

export function registerCompressionHandlers(mainWindow: BrowserWindow) {
  // 先移除已存在的处理器，避免重复注册
  ipcMain.removeHandler("compress-pictures");

  // 处理图片压缩请求
  ipcMain.handle(
    "compress-pictures",
    async (
      event,
      data: {
        imageItems: ImageItem[];
        outputDirectory: string;
        quality?: number;
      }
    ) => {
      try {
        const { imageItems, outputDirectory, quality = 80 } = data;
        const results = await compressImages(
          imageItems,
          outputDirectory,
          quality
        );

        safeSendToWindow(mainWindow, "compress-pictures-result", { results });
        return { success: true, results };
      } catch (error) {
        const errorMessage = handleError(error);
        safeSendToWindow(mainWindow, "compress-pictures-error", {
          error: errorMessage,
        });
        return { success: false, error: errorMessage };
      }
    }
  );
}
