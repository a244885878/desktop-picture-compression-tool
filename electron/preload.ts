import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { Item } from "./types";

contextBridge.exposeInMainWorld("electronAPI", {
  // 渲染进程向主进程（发送消息）
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  // 主进程获取渲染进程的消息（持续监听消息）
  receive: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any[]) =>
      callback(...args)
    );
  },
  // 主进程获取渲染进程的消息（仅监听一次）
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (event: IpcRendererEvent, ...args: any[]) =>
      callback(...args)
    );
  },
  // 调用图片压缩功能
  compressPictures: (data: {
    imageItems: Item[];
    outputDirectory: string;
    quality?: number;
  }) => {
    return ipcRenderer.invoke("compress-pictures", data);
  },
  // 调用删除文件功能
  deleteFiles: (items: Item[]) => {
    return ipcRenderer.invoke("delete-files", items);
  },
});
