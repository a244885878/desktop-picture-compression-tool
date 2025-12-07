import { promises as fs } from "fs";
import sharp from "sharp"; // 使用 sharp 进行跨格式图片压缩与编码
import bmp from "sharp-bmp";
import { FileItemTypeEnum, type FileItem } from "@/types";
import * as path from "path";

/**
 * 批量删除文件或文件夹（支持单个或多个）
 * @param filePaths 要删除的文件或文件夹的完整路径数组
 * @returns Promise<boolean> 全部删除成功返回 true，有任何失败返回 false
 *
 * 行为说明：
 * - 传入空数组时直接返回 true
 * - 文件夹采用递归删除
 * - 任意一个删除失败则最终返回 false
 */
export async function deleteFile(filePaths: string[]): Promise<boolean> {
  if (!filePaths || filePaths.length === 0) {
    return true;
  }

  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        // 规范化路径，避免路径问题
        let normalizedPath: string;
        try {
          normalizedPath = path.resolve(filePath);
        } catch (pathError) {
          const pathErrorMsg =
            pathError instanceof Error ? pathError.message : String(pathError);
          console.error(`路径解析失败: ${filePath}`, pathErrorMsg);
          return false;
        }

        // 检查文件是否存在
        let stats;
        try {
          stats = await fs.stat(normalizedPath);
        } catch (statError) {
          const statErrorMsg =
            statError instanceof Error ? statError.message : String(statError);
          console.error(
            `文件不存在或无法访问: ${normalizedPath}`,
            statErrorMsg
          );
          return false;
        }

        if (stats.isDirectory()) {
          // 如果是文件夹，递归删除
          try {
            await fs.rm(normalizedPath, { recursive: true, force: true });
          } catch (rmError) {
            const rmErrorMsg =
              rmError instanceof Error ? rmError.message : String(rmError);
            console.error(`删除文件夹失败: ${normalizedPath}`, rmErrorMsg);
            throw rmError;
          }
        } else {
          // 如果是文件，尝试删除
          try {
            // 先尝试直接删除
            await fs.unlink(normalizedPath);
          } catch (unlinkError) {
            const unlinkErrorCode =
              unlinkError &&
              typeof unlinkError === "object" &&
              "code" in unlinkError
                ? String(unlinkError.code)
                : undefined;

            // 如果是权限错误，尝试多种方式修复
            if (unlinkErrorCode === "EACCES" || unlinkErrorCode === "EPERM") {
              try {
                // 1. 先检查并修改父目录权限（确保有写权限）
                const parentDir = path.dirname(normalizedPath);
                try {
                  const parentStat = await fs.stat(parentDir);
                  if (parentStat.isDirectory()) {
                    // 确保父目录有写权限
                    await fs.chmod(parentDir, 0o755);
                  }
                } catch (parentError) {
                  console.warn(
                    `修改父目录权限失败（继续尝试）: ${parentDir}`,
                    parentError
                  );
                }

                // 2. 尝试修改文件权限
                try {
                  await fs.chmod(normalizedPath, 0o666);
                } catch (chmodError) {
                  console.warn(
                    `修改文件权限失败（继续尝试）: ${normalizedPath}`,
                    chmodError
                  );
                }

                // 3. 尝试移除 macOS 扩展属性（如果存在）
                try {
                  const { exec } = await import("child_process");
                  const { promisify } = await import("util");
                  const execAsync = promisify(exec);
                  await execAsync(`xattr -c "${normalizedPath}"`).catch(() => {
                    // 如果 xattr 命令失败（可能没有扩展属性），忽略错误
                  });
                } catch {
                  // xattr 命令可能不存在或失败，忽略
                }

                // 4. 重试删除
                await fs.unlink(normalizedPath);
              } catch (retryError) {
                // 所有修复尝试都失败
                const retryErrorMsg =
                  retryError instanceof Error
                    ? retryError.message
                    : String(retryError);
                const retryErrorCode =
                  retryError &&
                  typeof retryError === "object" &&
                  "code" in retryError
                    ? String(retryError.code)
                    : undefined;
                console.error(`修复权限后仍无法删除: ${normalizedPath}`, {
                  error: retryErrorMsg,
                  code: retryErrorCode,
                });
                throw unlinkError; // 抛出原始删除错误
              }
            } else {
              // 其他错误直接抛出
              const unlinkErrorMsg =
                unlinkError instanceof Error
                  ? unlinkError.message
                  : String(unlinkError);
              console.error(`删除文件失败: ${normalizedPath}`, unlinkErrorMsg);
              throw unlinkError;
            }
          }
        }

        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorCode =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : undefined;

        // 根据错误代码提供更友好的错误信息
        let friendlyError = errorMsg;
        if (errorCode === "EACCES" || errorCode === "EPERM") {
          friendlyError = `权限不足，无法删除文件。请检查文件权限或确保文件未被其他程序使用。\n原始错误: ${errorMsg}`;
        } else if (errorCode === "EBUSY") {
          friendlyError = `文件正在被其他程序使用，无法删除。\n原始错误: ${errorMsg}`;
        } else if (errorCode === "ENOENT") {
          friendlyError = `文件不存在或已被删除。\n原始错误: ${errorMsg}`;
        }

        console.error(`删除操作失败: ${filePath}`, {
          error: errorMsg,
          friendlyError,
          stack: errorStack,
          code: errorCode,
        });
        return false;
      }
    })
  );

  // 全部成功才返回 true
  const allSuccess = results.every((result) => result === true);
  if (!allSuccess) {
    console.error(
      `部分文件删除失败，成功: ${results.filter((r) => r).length}/${
        results.length
      }`
    );
  }
  return allSuccess;
}

/**
 * 重命名文件或文件夹
 * @param filePath 原始完整路径
 * @param newName 新名称（仅名称，不含路径；文件可省略扩展名，将沿用原扩展名）
 * @returns Promise<boolean> 成功返回 true，失败返回 false（如目标同名已存在等）
 *
 * 规则说明：
 * - 仅修改同目录下的名称，不改变路径位置
 * - 对文件：若 newName 不含扩展名，将自动保留原扩展名
 * - 当目标路径与原路径一致时视为成功（无需实际修改）
 * - 若同目录下存在同名目标，返回 false
 */
export async function renameFile(
  filePath: string,
  newName: string
): Promise<boolean> {
  if (!filePath || !newName || !newName.trim()) {
    throw new Error("文件路径或新名称无效");
  }

  const sanitized = newName.trim();
  if (sanitized.includes("/") || sanitized.includes("\\")) {
    throw new Error("新名称不能包含路径分隔符");
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    throw new Error("源路径不存在或不可访问");
  }

  const dir = path.dirname(filePath);
  let base = sanitized;

  if (stats.isFile()) {
    const oldExt = path.extname(filePath);
    const newExt = path.extname(base);
    if (!newExt && oldExt) {
      base = `${base}${oldExt}`;
    }
  }

  const targetPath = path.join(dir, base);

  if (targetPath === filePath) {
    return true;
  }

  let exists = true;
  try {
    await fs.access(targetPath);
  } catch {
    exists = false;
  }
  if (exists) {
    throw new Error("同名文件或文件夹已存在");
  }

  try {
    await fs.rename(filePath, targetPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`重命名失败: ${msg}`);
  }

  return true;
}

/**
 * 压缩结果类型
 * - inputPath：输入文件的绝对路径
 * - outputPath：输出文件的绝对路径（失败时为空字符串）
 * - success：是否压缩成功
 * - error：失败原因（仅在失败时存在）
 */
type CompressResult = {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
};

type ConvertResult = {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
};

type WatermarkResult = {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
};

type CropResult = {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
};

/**
 * 判断是否为支持的图片格式
 * 支持：jpg/jpeg、png、webp、tif/tiff、avif
 */
function isSupportedFormat(ext: string) {
  const e = ext.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"].includes(
    e
  );
}

/**
 * 确保目录存在（不存在则递归创建）
 */
async function ensureDir(dir: string): Promise<void> {
  // 先检查目录是否已存在
  try {
    const stat = await fs.stat(dir);
    if (stat.isDirectory()) {
      // 目录已存在，直接返回
      return;
    } else {
      // 路径存在但不是目录，抛出错误
      throw new Error(`路径已存在但不是目录: ${dir}`);
    }
  } catch (error) {
    // 目录不存在，尝试创建
    // 如果 stat 失败是因为文件不存在，这是正常的，继续创建
    const statError = error as NodeJS.ErrnoException;
    if (statError.code !== "ENOENT") {
      // 其他错误（如权限问题），直接抛出
      throw error;
    }

    // 目录不存在，尝试创建
    try {
      await fs.mkdir(dir, { recursive: true });
      // 创建后验证目录确实存在
      const verifyStat = await fs.stat(dir);
      if (!verifyStat.isDirectory()) {
        throw new Error(`创建后验证失败: ${dir} 不是目录`);
      }
    } catch (mkdirError) {
      const mkdirErr = mkdirError as NodeJS.ErrnoException;
      // 如果是因为目录已存在（并发创建的情况），验证一下
      if (mkdirErr.code === "EEXIST") {
        try {
          const verifyStat = await fs.stat(dir);
          if (verifyStat.isDirectory()) {
            return; // 目录已存在，正常返回
          }
        } catch {
          // 验证失败，抛出原始错误
        }
      }
      throw new Error(
        `无法创建目录 ${dir}: ${
          mkdirError instanceof Error ? mkdirError.message : String(mkdirError)
        }`
      );
    }
  }
}

async function resolveOutputDir(dir: string): Promise<string> {
  if (!dir || !dir.trim()) {
    throw new Error("输出目录路径不能为空");
  }

  const abs = path.resolve(dir.trim());

  try {
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      // 是目录，确保可访问并返回规范化路径
      await ensureDir(abs);
      try {
        const real = await fs.realpath(abs);
        return real;
      } catch {
        return abs;
      }
    } else {
      // 是文件，使用其父目录
      const parentDir = path.dirname(abs);
      await ensureDir(parentDir);
      try {
        const real = await fs.realpath(parentDir);
        return real;
      } catch {
        return parentDir;
      }
    }
  } catch {
    // 路径不存在，尝试创建
    // 先检查父目录是否存在
    const parentDir = path.dirname(abs);
    try {
      await fs.stat(parentDir);
      // 父目录存在，创建目标目录
      await ensureDir(abs);
      try {
        const real = await fs.realpath(abs);
        return real;
      } catch {
        return abs;
      }
    } catch {
      // 父目录也不存在，递归创建
      await ensureDir(abs);
      try {
        const real = await fs.realpath(abs);
        return real;
      } catch {
        return abs;
      }
    }
  }
}

/**
 * 根据命名规则生成输出文件路径并避免重名
 * 规则：
 * - 原文件名不包含"_压缩"：name.ext → name_压缩.ext
 * - 原文件名已包含"_压缩"：name_压缩.ext → name_压缩_1.ext；name_压缩_3.ext → name_压缩_4.ext
 * - 若目标已存在（文件或文件夹），则继续递增编号，直到找到可用文件名
 */
async function nextOutputPath(outputDir: string, inputPath: string) {
  // 确保输出目录是绝对路径
  const normalizedOutputDir = path.resolve(outputDir);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const m = base.match(/^(.*)_压缩(?:_(\d+))?$/);
  const root = m ? m[1] : base;
  let n = m && m[2] ? parseInt(m[2], 10) + 1 : m ? 1 : 0;

  let candidateBase = n === 0 ? `${root}_压缩` : `${root}_压缩_${n}`;
  let candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);

  while (true) {
    try {
      const stat = await fs.stat(candidate);
      // 如果路径存在（无论是文件还是文件夹），都需要递增编号
      if (stat.isFile() || stat.isDirectory()) {
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_压缩_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      } else {
        // 其他情况（如符号链接等），也递增编号
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_压缩_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      }
    } catch {
      // 路径不存在，当前候选名可用
      return candidate;
    }
  }
}

/**
 * 根据命名规则生成"转换"后的输出文件路径并避免重名
 * 规则：
 * - 原文件名不包含"_转换"：name.ext → name_转换.<targetExt>
 * - 原文件名已包含"_转换"：name_转换.ext → name_转换_1.<targetExt>；name_转换_3.ext → name_转换_4.<targetExt>
 * - 若目标已存在（文件或文件夹），则继续递增编号，直到找到可用文件名
 */
async function nextConvertedOutputPath(
  outputDir: string,
  inputPath: string,
  targetExt: string
) {
  // 确保输出目录是绝对路径
  const normalizedOutputDir = path.resolve(outputDir);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const m = base.match(/^(.*)_转换(?:_(\d+))?$/);
  const root = m ? m[1] : base;
  let n = m && m[2] ? parseInt(m[2], 10) + 1 : m ? 1 : 0;

  let candidateBase = n === 0 ? `${root}_转换` : `${root}_转换_${n}`;
  let candidate = path.resolve(
    normalizedOutputDir,
    `${candidateBase}${targetExt}`
  );

  while (true) {
    try {
      const stat = await fs.stat(candidate);
      // 如果路径存在（无论是文件还是文件夹），都需要递增编号
      if (stat.isFile() || stat.isDirectory()) {
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_转换_${n}`;
        candidate = path.resolve(
          normalizedOutputDir,
          `${candidateBase}${targetExt}`
        );
      } else {
        // 其他情况（如符号链接等），也递增编号
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_转换_${n}`;
        candidate = path.resolve(
          normalizedOutputDir,
          `${candidateBase}${targetExt}`
        );
      }
    } catch {
      // 路径不存在，当前候选名可用
      return candidate;
    }
  }
}

async function nextWatermarkOutputPath(outputDir: string, inputPath: string) {
  // 确保输出目录是绝对路径
  const normalizedOutputDir = path.resolve(outputDir);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const m = base.match(/^(.*)_水印(?:_(\d+))?$/);
  const root = m ? m[1] : base;
  let n = m && m[2] ? parseInt(m[2], 10) + 1 : m ? 1 : 0;

  let candidateBase = n === 0 ? `${root}_水印` : `${root}_水印_${n}`;
  let candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);

  while (true) {
    try {
      const stat = await fs.stat(candidate);
      // 如果路径存在（无论是文件还是文件夹），都需要递增编号
      if (stat.isFile() || stat.isDirectory()) {
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_水印_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      } else {
        // 其他情况（如符号链接等），也递增编号
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_水印_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      }
    } catch {
      // 路径不存在，当前候选名可用
      return candidate;
    }
  }
}

/**
 * 根据命名规则生成"裁剪"后的输出文件路径并避免重名
 * 规则：
 * - 原文件名不包含"_裁剪"：name.ext → name_裁剪.ext
 * - 原文件名已包含"_裁剪"：name_裁剪.ext → name_裁剪_1.ext；name_裁剪_3.ext → name_裁剪_4.ext
 * - 若目标已存在（文件或文件夹），则继续递增编号，直到找到可用文件名
 */
async function nextCropOutputPath(outputDir: string, inputPath: string) {
  // 确保输出目录是绝对路径
  const normalizedOutputDir = path.resolve(outputDir);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const m = base.match(/^(.*)_裁剪(?:_(\d+))?$/);
  const root = m ? m[1] : base;
  let n = m && m[2] ? parseInt(m[2], 10) + 1 : m ? 1 : 0;

  let candidateBase = n === 0 ? `${root}_裁剪` : `${root}_裁剪_${n}`;
  let candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);

  while (true) {
    try {
      const stat = await fs.stat(candidate);
      // 如果路径存在（无论是文件还是文件夹），都需要递增编号
      if (stat.isFile() || stat.isDirectory()) {
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_裁剪_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      } else {
        // 其他情况（如符号链接等），也递增编号
        n = n === 0 ? 1 : n + 1;
        candidateBase = `${root}_裁剪_${n}`;
        candidate = path.resolve(normalizedOutputDir, `${candidateBase}${ext}`);
      }
    } catch {
      // 路径不存在，当前候选名可用
      return candidate;
    }
  }
}

/**
 * 批量压缩图片文件
 * @param filePaths 需要压缩的图片绝对路径数组（仅文件）
 * @param outputDir 压缩后输出目录（不存在将自动创建）
 * @param quality 可选压缩质量（1-100，默认 80）
 * @returns { success, results }：总体成功标记与逐项结果
 *
 * 行为说明：
 * - 非文件或不支持的格式会返回失败项，但不影响其他文件的处理
 * - 输出文件扩展名保持与输入一致（不会跨格式转换）
 * - 命名规则遵循“原文件名_压缩”/“原文件名_压缩_序号”，避免重名
 */
export async function compressFiles(
  filePaths: string[],
  outputDir: string,
  quality?: number
): Promise<{ success: boolean; results: CompressResult[] }> {
  if (!filePaths || filePaths.length === 0) {
    return { success: true, results: [] };
  }

  // 质量校验与默认值处理
  const q =
    typeof quality === "number" && quality >= 1 && quality <= 100
      ? quality
      : 80;
  const targetDir = await resolveOutputDir(outputDir);

  const tasks = filePaths.map(async (inputPath): Promise<CompressResult> => {
    try {
      const stat = await fs.stat(inputPath);
      if (!stat.isFile()) {
        return {
          inputPath,
          outputPath: "",
          success: false,
          error: "not a file",
        };
      }

      const ext = path.extname(inputPath).toLowerCase();
      if (!isSupportedFormat(ext)) {
        return {
          inputPath,
          outputPath: "",
          success: false,
          error: "unsupported format",
        };
      }

      const outputPath = await nextOutputPath(targetDir, inputPath);

      // 确保输出文件的父目录存在
      const outputParentDir = path.dirname(outputPath);
      try {
        await ensureDir(outputParentDir);
        // 验证目录确实存在且可写
        const parentStat = await fs.stat(outputParentDir);
        if (!parentStat.isDirectory()) {
          throw new Error(`输出目录不是有效的目录: ${outputParentDir}`);
        }
      } catch (dirError) {
        const dirErrorMsg =
          dirError instanceof Error ? dirError.message : String(dirError);
        const dirErrorCode =
          dirError && typeof dirError === "object" && "code" in dirError
            ? String(dirError.code)
            : undefined;
        console.error(`无法创建或验证输出目录: ${outputParentDir}`, {
          error: dirErrorMsg,
          code: dirErrorCode,
        });
        throw new Error(`无法创建输出目录: ${dirErrorMsg}`);
      }

      // failOn: "none" 避免遇到损坏元数据时抛错
      const image = sharp(inputPath, { failOn: "none" });

      switch (ext) {
        case ".jpg":
        case ".jpeg":
          // 使用 mozjpeg 优化 JPEG 压缩
          await image.jpeg({ quality: q, mozjpeg: true }).toFile(outputPath);
          break;
        case ".png":
          // PNG：启用调色板并提高压缩等级，quality 表示输出质量倾向
          await image
            .png({ quality: q, compressionLevel: 9, palette: true })
            .toFile(outputPath);
          break;
        case ".webp":
          // WebP 有损压缩
          await image.webp({ quality: q }).toFile(outputPath);
          break;
        case ".tif":
        case ".tiff":
          // TIFF 有损压缩（若需无损可改用 compression/ predictor 配置）
          await image.tiff({ quality: q }).toFile(outputPath);
          break;
        case ".avif":
          // AVIF 有损压缩（可结合 chromaSubsampling 等参数进一步调优）
          await image.avif({ quality: q }).toFile(outputPath);
          break;
        default:
          return {
            inputPath,
            outputPath: "",
            success: false,
            error: "unsupported format",
          };
      }

      return { inputPath, outputPath, success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorCode =
        e && typeof e === "object" && "code" in e ? String(e.code) : undefined;
      const errorStack = e instanceof Error ? e.stack : undefined;
      console.error(`压缩文件失败: ${inputPath}`, {
        error: msg,
        code: errorCode,
        stack: errorStack,
      });
      return { inputPath, outputPath: "", success: false, error: msg };
    }
  });

  const results = await Promise.all(tasks);
  const allSuccess = results.every((r) => r.success);
  if (!allSuccess) {
    const failedCount = results.filter((r) => !r.success).length;
    console.error(
      `压缩操作部分失败: ${failedCount}/${results.length} 个文件失败`
    );
    results.forEach((r) => {
      if (!r.success) {
        console.error(`  - ${r.inputPath}: ${r.error}`);
      }
    });
  }
  return { success: allSuccess, results };
}

/**
 * 批量格式转换（不影响原文件）
 * @param files 文件对象数组（仅图片类型有效）
 * @param outputDir 输出目录（不存在将自动创建）
 * @param targetFormat 目标格式（支持 jpg、png、bmp）
 * @returns { success, results }：总体成功标记与逐项结果
 *
 * 行为说明：
 * - 非图片或非文件会返回失败项，但不影响其他文件处理
 * - 始终生成新文件，命名遵循“原文件名_转换”/“原文件名_转换_序号”，避免重名
 * - JPG 采用 mozjpeg 优化；PNG 使用默认编码；BMP 通过 sharp-bmp 输出
 */
export async function convertFiles(
  tasks: { file: FileItem; targetFormat: "jpg" | "png" | "bmp" }[],
  outputDir: string
): Promise<{ success: boolean; results: ConvertResult[] }> {
  if (!tasks || tasks.length === 0) {
    return { success: true, results: [] };
  }

  const targetDir = await resolveOutputDir(outputDir);

  const jobs = tasks.map(
    async ({ file, targetFormat }): Promise<ConvertResult> => {
      const inputPath = file.path;
      try {
        if (file.type !== FileItemTypeEnum.IMAGE) {
          return {
            inputPath,
            outputPath: "",
            success: false,
            error: "not an image",
          };
        }

        const stat = await fs.stat(inputPath);
        if (!stat.isFile()) {
          return {
            inputPath,
            outputPath: "",
            success: false,
            error: "not a file",
          };
        }

        const fmt = String(targetFormat).toLowerCase();
        if (!["jpg", "png", "bmp"].includes(fmt)) {
          return {
            inputPath,
            outputPath: "",
            success: false,
            error: "unsupported target format",
          };
        }

        const targetExt =
          fmt === "jpg" ? ".jpg" : fmt === "png" ? ".png" : ".bmp";
        const outputPath = await nextConvertedOutputPath(
          targetDir,
          inputPath,
          targetExt
        );

        // 确保输出文件的父目录存在
        const outputParentDir = path.dirname(outputPath);
        try {
          await ensureDir(outputParentDir);
          // 验证目录确实存在且可写
          const parentStat = await fs.stat(outputParentDir);
          if (!parentStat.isDirectory()) {
            throw new Error(`输出目录不是有效的目录: ${outputParentDir}`);
          }
        } catch (dirError) {
          const dirErrorMsg =
            dirError instanceof Error ? dirError.message : String(dirError);
          const dirErrorCode =
            dirError && typeof dirError === "object" && "code" in dirError
              ? String((dirError as { code: unknown }).code)
              : undefined;
          console.error(`无法创建或验证输出目录: ${outputParentDir}`, {
            error: dirErrorMsg,
            code: dirErrorCode,
          });
          throw new Error(`无法创建输出目录: ${dirErrorMsg}`);
        }
        const image = sharp(inputPath, { failOn: "none" });

        if (fmt === "jpg") {
          await image.jpeg({ mozjpeg: true }).toFile(outputPath);
        } else if (fmt === "png") {
          await image.png().toFile(outputPath);
        } else {
          await bmp.sharpToBmp(image, outputPath);
        }

        return { inputPath, outputPath, success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const errorCode =
          e && typeof e === "object" && "code" in e
            ? String(e.code)
            : undefined;
        const errorStack = e instanceof Error ? e.stack : undefined;
        console.error(`转换文件失败: ${inputPath}`, {
          error: msg,
          code: errorCode,
          stack: errorStack,
        });
        return { inputPath, outputPath: "", success: false, error: msg };
      }
    }
  );

  const results = await Promise.all(jobs);
  return { success: results.every((r) => r.success), results };
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 删除单图加水印 API，批量 API 已覆盖单图场景

type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

function buildWatermarkSvg(
  width: number,
  height: number,
  text: string,
  color: string,
  fontSize: number,
  position: WatermarkPosition,
  padding: number,
  angle: number
) {
  let x = width - padding;
  let y = height - padding;
  let anchor = "end";
  let baseline = "alphabetic";
  switch (position) {
    case "top-left":
      x = padding;
      y = padding + fontSize;
      anchor = "start";
      break;
    case "top-right":
      x = width - padding;
      y = padding + fontSize;
      anchor = "end";
      break;
    case "bottom-left":
      x = padding;
      y = height - padding;
      anchor = "start";
      break;
    case "bottom-right":
      x = width - padding;
      y = height - padding;
      anchor = "end";
      break;
    case "center":
      x = Math.round(width / 2);
      y = Math.round(height / 2);
      anchor = "middle";
      baseline = "middle";
      break;
  }
  const rotate = Number.isFinite(angle) ? Math.round(angle) : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="sans-serif" font-size="${fontSize}" fill="${color}" paint-order="stroke" stroke="rgba(0,0,0,0.5)" stroke-width="2" transform="rotate(${rotate} ${x} ${y})">${text}</text></svg>`;
  return Buffer.from(svg);
}

function buildWatermarkSvgAt(
  width: number,
  height: number,
  text: string,
  color: string,
  fontSize: number,
  x: number,
  y: number,
  angle: number
) {
  const rotate = Number.isFinite(angle) ? Math.round(angle) : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fontSize}" fill="${color}" paint-order="stroke" stroke="rgba(0,0,0,0.5)" stroke-width="2" transform="rotate(${rotate} ${x} ${y})">${text}</text></svg>`;
  return Buffer.from(svg);
}

export async function addWatermarks(
  files: FileItem[],
  text: string,
  outputDir: string,
  opts?: {
    fontSize?: number;
    color?: string;
    position?: WatermarkPosition;
    padding?: number;
    angle?: number;
    xRatio?: number;
    yRatio?: number;
  }
): Promise<{ success: boolean; results: WatermarkResult[] }> {
  if (!files || files.length === 0) {
    return { success: true, results: [] };
  }
  const content = (text ?? "").trim();
  if (!content) {
    return {
      success: false,
      results: files.map((f) => ({
        inputPath: f.path,
        outputPath: "",
        success: false,
        error: "watermark text empty",
      })),
    };
  }
  if (content.length > 10) {
    return {
      success: false,
      results: files.map((f) => ({
        inputPath: f.path,
        outputPath: "",
        success: false,
        error: "watermark text too long",
      })),
    };
  }
  const targetDir = await resolveOutputDir(outputDir);
  const safeText = escapeXml(content);
  const jobs = files.map(async (file): Promise<WatermarkResult> => {
    const inputPath = file.path;
    try {
      if (file.type !== FileItemTypeEnum.IMAGE) {
        return {
          inputPath,
          outputPath: "",
          success: false,
          error: "not an image",
        };
      }
      const stat = await fs.stat(inputPath);
      if (!stat.isFile()) {
        return {
          inputPath,
          outputPath: "",
          success: false,
          error: "not a file",
        };
      }
      const meta = await sharp(inputPath, { failOn: "none" }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        throw new Error("无法读取图片尺寸");
      }
      const paddingDefault = Math.max(
        10,
        Math.round(Math.min(width, height) * 0.03)
      );
      const fontDefault = Math.max(
        16,
        Math.round(Math.min(width, height) * 0.05)
      );
      // 字体大小限制：不能超过图片最小边的2倍，也不能小于8
      // 这样可以避免字体过大导致渲染问题
      const maxFontSize = Math.min(width, height) * 2;
      const fontSize =
        opts?.fontSize && opts.fontSize > 0
          ? Math.max(8, Math.min(Math.round(opts.fontSize), maxFontSize))
          : fontDefault;
      const color =
        opts?.color && opts.color.trim()
          ? opts.color.trim()
          : "rgba(255,255,255,0.75)";
      const angle = opts?.angle ?? 0;
      let svg: Buffer;
      if (
        typeof opts?.xRatio === "number" &&
        typeof opts?.yRatio === "number"
      ) {
        const xr = Math.max(0, Math.min(1, opts.xRatio));
        const yr = Math.max(0, Math.min(1, opts.yRatio));
        const x = Math.round(width * xr);
        const y = Math.round(height * yr);
        svg = buildWatermarkSvgAt(
          width,
          height,
          safeText,
          color,
          fontSize,
          x,
          y,
          angle
        );
      } else {
        const position = opts?.position ?? "bottom-right";
        const pad =
          opts?.padding && opts.padding > 0
            ? Math.round(opts.padding)
            : paddingDefault;
        svg = buildWatermarkSvg(
          width,
          height,
          safeText,
          color,
          fontSize,
          position,
          pad,
          angle
        );
      }
      const outputPath = await nextWatermarkOutputPath(targetDir, inputPath);

      // 确保输出文件的父目录存在
      const outputParentDir = path.dirname(outputPath);
      try {
        await ensureDir(outputParentDir);
        // 验证目录确实存在且可写
        const parentStat = await fs.stat(outputParentDir);
        if (!parentStat.isDirectory()) {
          throw new Error(`输出目录不是有效的目录: ${outputParentDir}`);
        }
      } catch (dirError) {
        const dirErrorMsg =
          dirError instanceof Error ? dirError.message : String(dirError);
        const dirErrorCode =
          dirError && typeof dirError === "object" && "code" in dirError
            ? String((dirError as { code: unknown }).code)
            : undefined;
        console.error(`无法创建或验证输出目录: ${outputParentDir}`, {
          error: dirErrorMsg,
          code: dirErrorCode,
        });
        throw new Error(`无法创建输出目录: ${dirErrorMsg}`);
      }

      await sharp(inputPath, { failOn: "none" })
        .composite([{ input: svg }])
        .toFile(outputPath);
      return { inputPath, outputPath, success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorCode =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code)
          : undefined;
      const errorStack = e instanceof Error ? e.stack : undefined;
      console.error(`添加水印失败: ${inputPath}`, {
        error: msg,
        code: errorCode,
        stack: errorStack,
      });
      return { inputPath, outputPath: "", success: false, error: msg };
    }
  });
  const results = await Promise.all(jobs);
  return { success: results.every((r) => r.success), results };
}

/**
 * 裁剪图片（单张）
 * @param file 文件对象（仅图片类型有效）
 * @param outputDir 输出目录（不存在将自动创建）
 * @param cropArea 裁剪区域 { left: number, top: number, width: number, height: number }
 * @returns { success, result }：成功标记与结果
 *
 * 行为说明：
 * - 非图片或非文件会返回失败
 * - 始终生成新文件，命名遵循"原文件名_裁剪"/"原文件名_裁剪_序号"，避免重名
 * - 裁剪区域坐标和尺寸必须是整数，且不能超出图片范围
 */
export async function cropImage(
  file: FileItem,
  outputDir: string,
  cropArea: { left: number; top: number; width: number; height: number }
): Promise<{ success: boolean; result: CropResult }> {
  const inputPath = file.path;

  try {
    if (file.type !== FileItemTypeEnum.IMAGE) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: "not an image",
        },
      };
    }

    const stat = await fs.stat(inputPath);
    if (!stat.isFile()) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: "not a file",
        },
      };
    }

    // 验证裁剪区域参数
    const left = Math.round(cropArea.left);
    const top = Math.round(cropArea.top);
    const width = Math.round(cropArea.width);
    const height = Math.round(cropArea.height);

    if (width <= 0 || height <= 0) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: "裁剪区域宽度和高度必须大于0",
        },
      };
    }

    if (left < 0 || top < 0) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: "裁剪区域坐标不能为负数",
        },
      };
    }

    // 获取图片尺寸
    const meta = await sharp(inputPath, { failOn: "none" }).metadata();
    const imageWidth = meta.width ?? 0;
    const imageHeight = meta.height ?? 0;

    if (!imageWidth || !imageHeight) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: "无法读取图片尺寸",
        },
      };
    }

    // 验证裁剪区域是否超出图片范围
    if (left + width > imageWidth || top + height > imageHeight) {
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: `裁剪区域超出图片范围。图片尺寸: ${imageWidth}x${imageHeight}, 裁剪区域: left=${left}, top=${top}, width=${width}, height=${height}`,
        },
      };
    }

    const targetDir = await resolveOutputDir(outputDir);
    const outputPath = await nextCropOutputPath(targetDir, inputPath);

    // 确保输出文件的父目录存在
    const outputParentDir = path.dirname(outputPath);
    try {
      await ensureDir(outputParentDir);
      // 验证目录确实存在且可写
      const parentStat = await fs.stat(outputParentDir);
      if (!parentStat.isDirectory()) {
        throw new Error(`输出目录不是有效的目录: ${outputParentDir}`);
      }
    } catch (dirError) {
      const dirErrorMsg =
        dirError instanceof Error ? dirError.message : String(dirError);
      const dirErrorCode =
        dirError && typeof dirError === "object" && "code" in dirError
          ? String((dirError as { code: unknown }).code)
          : undefined;
      console.error(`无法创建或验证输出目录: ${outputParentDir}`, {
        error: dirErrorMsg,
        code: dirErrorCode,
      });
      return {
        success: false,
        result: {
          inputPath,
          outputPath: "",
          success: false,
          error: `无法创建输出目录: ${dirErrorMsg}`,
        },
      };
    }

    // 执行裁剪
    await sharp(inputPath, { failOn: "none" })
      .extract({ left, top, width, height })
      .toFile(outputPath);

    return {
      success: true,
      result: { inputPath, outputPath, success: true },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorCode =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : undefined;
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error(`裁剪图片失败: ${inputPath}`, {
      error: msg,
      code: errorCode,
      stack: errorStack,
    });
    return {
      success: false,
      result: { inputPath, outputPath: "", success: false, error: msg },
    };
  }
}
