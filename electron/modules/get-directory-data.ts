import * as fs from "fs";
import * as path from "path";
import mime from "mime";
import type { DirData, Item } from "../types";
import { ItemType } from "../enum";
import { createHash } from "crypto";

// 支持的图片扩展名
const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
];

/**
 * 将图片文件转换为base64格式
 * @param filePath 图片文件路径
 * @param mimeType 图片的MIME类型
 * @returns base64格式的图片URL
 */
function imageToBase64(filePath: string, mimeType: string): string {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64String = imageBuffer.toString("base64");
    return `data:${mimeType};base64,${base64String}`;
  } catch (error) {
    console.error(`转换图片为base64失败: ${filePath}`, error);
    // 如果转换失败，返回一个占位符图片或空字符串
    return "";
  }
}

/**
 * 获取桌面路径
 * @returns 桌面路径
 */
function getDesktopPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error("无法获取用户主目录");
  }

  // Windows 桌面路径
  if (process.platform === "win32") {
    return path.join(homeDir, "Desktop");
  }

  // macOS 桌面路径
  if (process.platform === "darwin") {
    return path.join(homeDir, "Desktop");
  }

  // Linux 桌面路径
  if (process.platform === "linux") {
    return path.join(homeDir, "Desktop");
  }

  // 默认返回主目录
  return homeDir;
}

/**
 * 根据文件路径生成唯一ID
 * @param filePath 文件路径
 * @returns 基于路径的唯一ID
 */
function generateFileId(filePath: string): string {
  const normalizedPath = path.normalize(filePath);
  const hash = createHash("md5").update(normalizedPath).digest("hex");
  return hash;
}

/**
 * 获取Windows磁盘列表
 * @returns 磁盘列表数据
 */
function getWindowsDrives(): DirData {
  const drives: Item[] = [];

  // 获取所有可用磁盘
  for (let i = 65; i <= 90; i++) {
    // A-Z
    const driveLetter = String.fromCharCode(i);
    const drivePath = `${driveLetter}:\\`;

    try {
      if (fs.existsSync(drivePath)) {
        drives.push({
          name: `${driveLetter}:`,
          type: ItemType.FOLDER,
          path: drivePath,
          id: generateFileId(drivePath),
        });
      }
    } catch {
      // 忽略无法访问的磁盘
    }
  }

  return {
    breadcrumb: ["此电脑"],
    items: drives,
  };
}

/**
 * 获取指定路径（或默认根目录路径）下的文件夹和图片信息
 * @param targetPath 可选路径参数，不传则获取默认目录路径
 * @returns 目录数据（面包屑 + 项列表）
 */
export function getDirectoryData(targetPath?: string): DirData {
  // 如果没有传入路径，则根据平台返回默认路径
  let basePath: string;
  if (!targetPath) {
    if (process.platform === "win32") {
      // Windows 返回磁盘列表
      return getWindowsDrives();
    } else {
      // macOS/Linux 返回桌面
      basePath = getDesktopPath();
    }
  } else {
    // 如果传入的是相对路径（如"Desktop"），则相对于桌面路径
    if (!path.isAbsolute(targetPath)) {
      const desktopPath = getDesktopPath();
      basePath = path.join(desktopPath, targetPath);
    } else {
      // 如果是绝对路径，直接使用
      basePath = path.resolve(targetPath);
    }
  }

  // 确保路径存在
  if (!fs.existsSync(basePath)) {
    throw new Error(`路径不存在: ${basePath}`);
  }

  // 检查是否为目录
  const stat = fs.statSync(basePath);
  if (!stat.isDirectory()) {
    throw new Error(`路径不是目录: ${basePath}`);
  }

  // 获取面包屑导航
  const breadcrumb = getBreadcrumb(basePath);
  const items: Item[] = [];

  try {
    const files = fs.readdirSync(basePath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(basePath, file.name);

      if (file.isDirectory()) {
        items.push({
          name: file.name,
          type: ItemType.FOLDER,
          path: fullPath,
          id: generateFileId(fullPath),
        });
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const fileStat = fs.statSync(fullPath);
          const mimeType = mime.getType(ext) || "image/*";
          items.push({
            name: file.name,
            type: ItemType.IMAGE,
            path: fullPath,
            previewUrl: imageToBase64(fullPath, mimeType),
            mimeType,
            size: fileStat.size,
            id: generateFileId(fullPath),
          });
        }
      }
    }
  } catch (error) {
    console.error("读取目录失败:", error);
    // 如果读取失败，返回空列表而不是抛出错误
    return {
      breadcrumb,
      items: [],
    };
  }

  return {
    breadcrumb,
    items,
  };
}

/**
 * 根据路径生成面包屑导航
 * @param fullPath 完整路径
 * @returns 面包屑数组
 */
function getBreadcrumb(fullPath: string): string[] {
  const normalizedPath = path.normalize(fullPath);

  // 在Windows上，保留盘符
  if (process.platform === "win32") {
    const parts = normalizedPath.split(path.sep);
    // 过滤空字符串，但保留盘符（如"C:"）
    const filteredParts = parts.filter((part, index) => {
      if (index === 0 && part.endsWith(":")) {
        return true; // 保留盘符
      }
      return part.length > 0;
    });

    // 如果是根目录（如"C:"），确保返回盘符
    if (filteredParts.length === 0 && parts.length > 0) {
      return [parts[0]]; // 返回盘符
    }

    return filteredParts;
  } else {
    // macOS/Linux
    const parts = normalizedPath.split(path.sep);
    // 过滤空字符串，但保留根目录的"/"
    const filteredParts = parts.filter((part, index) => {
      if (index === 0 && part === "") {
        return true; // 保留根目录
      }
      return part.length > 0;
    });

    // 如果是根目录（如"/"），确保返回根目录标识
    if (filteredParts.length === 0) {
      return ["/"]; // 返回根目录标识
    }

    return filteredParts;
  }
}
