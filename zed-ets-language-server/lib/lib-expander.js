import fs from 'fs/promises';
import path from 'path';

/**
 * 根据提供的路径，返回其中所有符合正则要求文件名的文件名列表
 * @param {string} dirPath - 要搜索的目录路径
 * @param {RegExp} pattern - 用于匹配文件名的正则表达式
 * @param {boolean} recursive - 是否递归搜索子目录，默认为 true
 * @returns {Promise<string[]>} 符合条件的文件名列表的 Promise
 */
export async function getFilesByPattern(dirPath, pattern, recursive = true) {
  const result = [];
  
  try {
    // 检查路径是否存在
    try {
      await fs.access(dirPath);
    } catch (error) {
      console.warn(`路径不存在: ${dirPath}`);
      return result;
    }
  
    // 检查是否为目录
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      console.warn(`路径不是目录: ${dirPath}`);
      return result;
    }
  
    // 读取目录内容
    const items = await fs.readdir(dirPath);
    
    // 使用 Promise.all 并行处理所有项目
    const promises = items.map(async (item) => {
      const fullPath = path.join(dirPath, item);
      
      try {
        const itemStat = await fs.stat(fullPath);

        if (itemStat.isDirectory() && recursive) {
          // 递归搜索子目录
          const subResult = await getFilesByPattern(fullPath, pattern, recursive);
          return subResult;
        } else if (itemStat.isFile()) {
          // 检查文件名是否匹配正则表达式
          if (pattern.test(fullPath)) {
            return [fullPath];
          }
        }
      } catch (error) {
        console.error(`处理文件/目录时出错: ${fullPath}`, error.message);
      }

      return [];
    });

    // 等待所有 Promise 完成
    const results = await Promise.all(promises);

    // 合并所有结果
    for (const subResult of results) {
      result.push(...subResult);
    }

  } catch (error) {
    console.error(`读取目录时出错: ${dirPath}`, error.message);
  }
  
  return result;
}

export async function listLibs(dirPath) {
  return await getFilesByPattern(dirPath, /d\.ts$/i);
}

export async function listHelperPaths(tsDir, harmonyDir) {
  const etsComponentPath = path.join(harmonyDir, '/ets/component');
  const etsLoaderConfigPath = path.join(harmonyDir, '/ets/build-tools/ets-loader/tsconfig.json');
  const etsLoaderPath = path.join(harmonyDir, '/ets/build-tools/ets-loader');
  const etsLoaderLibs = await listLibs(path.join(etsLoaderPath, '/declarations'));

  return {
    sdkPath: harmonyDir,
    etsComponentPath,
    etsLoaderConfigPath,
    etsLoaderPath,
    baseUrl: path.join(harmonyDir, '/ets'),
    lib: [...(await listLibs(tsDir)), ...(await listLibs(etsComponentPath)), ...etsLoaderLibs],
    "paths": {
      "*": ["./api/*", "./kits/*", "./arkts/*"],
      "@internal/full/*": ["./api/@internal/full/*"]
    },
  };
}