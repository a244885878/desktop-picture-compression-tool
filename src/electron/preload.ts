import { contextBridge } from "electron";
import {
  getDirectoryContents,
  getBreadcrumbList,
  getFileInfo,
} from "./module/directory";
import {
  deleteFile,
  renameFile,
  compressFiles,
  convertFiles,
  addWatermarks,
  cropImage,
} from "./module/handleFile";

contextBridge.exposeInMainWorld("electronAPI", {
  getDirectoryContents, // 获取目录内容
  getBreadcrumbList, // 获取面包屑列表
  deleteFile, // 批量删除文件
  renameFile, // 重命名文件
  compressFiles, // 批量压缩图片
  convertFiles, // 批量格式转换
  addWatermarks, // 加水印
  cropImage, // 裁剪图片
  getFileInfo, // 获取文件详细信息
});
