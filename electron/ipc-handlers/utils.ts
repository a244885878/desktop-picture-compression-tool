import { BrowserWindow } from "electron";

/**
 * 检查窗口是否还存在且未被销毁
 */
export function isWindowValid(window: BrowserWindow | null): boolean {
  return window !== null && !window.isDestroyed();
}

/**
 * 安全地向窗口发送消息
 */
export function safeSendToWindow(
  window: BrowserWindow | null,
  channel: string,
  data: any
): void {
  if (isWindowValid(window)) {
    window!.webContents.send(channel, data);
  }
}

/**
 * 处理错误并返回标准化的错误信息
 */
export function handleError(error: unknown): string {
  console.error("操作失败:", error);
  return error instanceof Error ? error.message : "未知错误";
}

/**
 * 创建标准化的响应对象
 */
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string
): { success: boolean; data?: T; error?: string } {
  return { success, ...(data && { data }), ...(error && { error }) };
}
