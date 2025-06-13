// 获取系统盘符列表
import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * 获取桌面路径
 */
function getDesktopPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, "Desktop");
}

/**
 * 获取所有驱动器/盘符路径（跨平台）
 */
function getDriveLetters(): string[] {
  const platform = os.platform();

  if (platform === "win32") {
    try {
      const stdout = execSync("wmic logicaldisk get name", {
        encoding: "utf-8",
      });
      const lines = stdout.split("\n").filter((line) => /^[A-Z]:/.test(line));
      return lines.map((line) => line.trim());
    } catch (e) {
      return [];
    }
  } else {
    // 对于 macOS 和 Linux，我们列出 /Volumes 或根目录下的挂载点
    const drives: string[] = [];

    // macOS: /Volumes 中的挂载盘
    if (platform === "darwin") {
      const volumeDir = "/Volumes";
      try {
        const items = fs.readdirSync(volumeDir);
        for (const item of items) {
          const fullPath = path.join(volumeDir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            drives.push(fullPath);
          }
        }
      } catch (e) {}
    }

    // Linux: 挂载点通常在 /mnt、/media、/
    if (platform === "linux") {
      const mountDirs = ["/mnt", "/media", "/"];

      for (const dir of mountDirs) {
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
              drives.push(fullPath);
            }
          }
        } catch (e) {}
      }
    }

    return drives;
  }
}

/**
 * 获取系统盘符（包括桌面）
 */
export function getSystemPaths(): string[] {
  const drives = getDriveLetters();
  const desktop = getDesktopPath();

  // 去重并返回
  const allPaths = [...new Set([...drives, desktop])];
  return allPaths;
}
