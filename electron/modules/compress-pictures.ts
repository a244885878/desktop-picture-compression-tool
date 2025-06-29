import * as fs from "fs-extra";
import * as path from "path";
import sharp from "sharp";
import type { ImageItem } from "../types";

export interface CompressResult {
  success: boolean;
  originalPath: string;
  compressedPath?: string;
  error?: string;
}

/**
 * 生成副本文件名
 * @param originalName 原始文件名（不含扩展名）
 * @param extension 文件扩展名
 * @param directory 目录路径
 * @returns 新的文件名
 */
function generateCopyFileName(
  originalName: string,
  extension: string,
  directory: string
): string {
  let baseName = originalName;
  let existingNumber = 0;

  // 检查文件名是否已经包含"_副本"模式
  const copyPattern = /^(.+?)_副本(\d*)$/;
  const match = originalName.match(copyPattern);

  if (match) {
    // 如果匹配到"_副本"模式，提取基础名称和现有数字
    baseName = match[1];
    existingNumber = match[2] ? parseInt(match[2]) : 1;
  }

  // 从现有数字开始递增，如果没有现有数字则从1开始
  let counter = existingNumber + 1;
  let newName = `${baseName}_副本`;
  let fullPath = path.join(directory, `${newName}${extension}`);

  // 检查文件是否已存在，如果存在则添加数字后缀
  while (fs.existsSync(fullPath)) {
    newName = `${baseName}_副本${counter}`;
    fullPath = path.join(directory, `${newName}${extension}`);
    counter++;
  }

  return `${newName}${extension}`;
}

/**
 * 压缩单张图片
 * @param imageItem 图片项
 * @param outputDirectory 输出目录
 * @param quality 压缩质量 (1-100)
 * @returns 压缩结果
 */
export async function compressImage(
  imageItem: ImageItem,
  outputDirectory: string,
  quality: number = 80
): Promise<CompressResult> {
  try {
    const originalPath = imageItem.path;
    const originalName = path.basename(
      originalPath,
      path.extname(originalPath)
    );
    const extension = path.extname(originalPath).toLowerCase();

    // 生成副本文件名
    const newFileName = generateCopyFileName(
      originalName,
      extension,
      outputDirectory
    );
    const outputPath = path.join(outputDirectory, newFileName);

    // 确保输出目录存在
    await fs.ensureDir(outputDirectory);

    // 根据文件类型进行压缩
    let sharpInstance = sharp(originalPath);

    switch (extension) {
      case ".jpg":
      case ".jpeg":
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case ".png":
        sharpInstance = sharpInstance.png({ quality });
        break;
      case ".webp":
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case ".gif":
        // GIF 文件保持原样，不进行压缩
        await fs.copy(originalPath, outputPath);
        return {
          success: true,
          originalPath,
          compressedPath: outputPath,
        };
      default: {
        // 其他格式转换为 JPEG
        sharpInstance = sharpInstance.jpeg({ quality });
        const newExtension = ".jpg";
        const newFileNameWithJpg = generateCopyFileName(
          originalName,
          newExtension,
          outputDirectory
        );
        const outputPathJpg = path.join(outputDirectory, newFileNameWithJpg);
        await sharpInstance.toFile(outputPathJpg);
        return {
          success: true,
          originalPath,
          compressedPath: outputPathJpg,
        };
      }
    }

    // 执行压缩
    await sharpInstance.toFile(outputPath);

    return {
      success: true,
      originalPath,
      compressedPath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      originalPath: imageItem.path,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 批量压缩图片
 * @param imageItems 图片项数组
 * @param outputDirectory 输出目录
 * @param quality 压缩质量 (1-100)
 * @returns 压缩结果数组
 */
export async function compressImages(
  imageItems: ImageItem[],
  outputDirectory: string,
  quality: number = 80
): Promise<CompressResult[]> {
  const results: CompressResult[] = [];

  for (const imageItem of imageItems) {
    const result = await compressImage(imageItem, outputDirectory, quality);
    results.push(result);
  }

  return results;
}
