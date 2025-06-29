import * as fs from "fs-extra";
import type { Item } from "../types";
import { ItemType } from "../enum";

export interface DeleteResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * 删除单个文件或文件夹
 * @param item 要删除的项目
 * @returns 删除结果
 */
export async function deleteItem(item: Item): Promise<DeleteResult> {
  try {
    const itemPath = item.path;

    // 检查路径是否存在
    if (!fs.existsSync(itemPath)) {
      return {
        success: false,
        path: itemPath,
        error: "文件或文件夹不存在",
      };
    }

    if (item.type === ItemType.FOLDER) {
      // 删除文件夹
      await fs.remove(itemPath);
    } else {
      // 删除文件
      await fs.unlink(itemPath);
    }

    return {
      success: true,
      path: itemPath,
    };
  } catch (error) {
    console.error(`删除失败: ${item.path}`, error);
    return {
      success: false,
      path: item.path,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 批量删除文件或文件夹
 * @param items 要删除的项目列表
 * @returns 删除结果列表
 */
export async function deleteItems(items: Item[]): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];

  // 并发删除所有项目
  const deletePromises = items.map((item) => deleteItem(item));
  const deleteResults = await Promise.allSettled(deletePromises);

  // 处理结果
  deleteResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      // 如果Promise被拒绝，创建一个错误结果
      results.push({
        success: false,
        path: items[index].path,
        error:
          result.reason instanceof Error ? result.reason.message : "未知错误",
      });
    }
  });

  return results;
}
