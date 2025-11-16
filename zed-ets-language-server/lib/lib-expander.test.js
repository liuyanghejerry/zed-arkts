import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFilesByPattern, listLibs, listHelperPaths } from './lib-expander.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');

// Mock console methods
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe('lib-expander', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('getFilesByPattern', () => {
    it('should return an empty array when directory does not exist', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      const result = await getFilesByPattern('/nonexistent/path', /\.ts$/);
      
      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('路径不存在: /nonexistent/path');
    });

    it('should return an empty array when path is not a directory', async () => {
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      
      const result = await getFilesByPattern('/some/file.txt', /\.ts$/);
      
      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('路径不是目录: /some/file.txt');
    });

    it('should return matching files from a directory', async () => {
      const mockFiles = ['file1.ts', 'file2.js', 'file3.ts', 'file4.txt'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);
      
      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/dir') {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('file1.ts') || filePath.includes('file2.js') || 
            filePath.includes('file3.ts') || filePath.includes('file4.txt')) {
          return Promise.resolve(mockFileStats);
        }
        return Promise.reject(new Error('File not found'));
      });

      const pattern = /\.ts$/;
      const result = await getFilesByPattern('/test/dir', pattern);

      expect(result).toEqual([
        path.join('/test/dir', 'file1.ts'),
        path.join('/test/dir', 'file3.ts')
      ]);
    });

    it('should search recursively when recursive is true', async () => {
      const mockFiles = ['file1.ts', 'subdir'];
      const mockSubFiles = ['file2.ts', 'file3.js'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      
      fs.readdir.mockImplementation((dirPath) => {
        if (dirPath === '/test/dir') {
          return Promise.resolve(mockFiles);
        } else if (dirPath === '/test/dir/subdir') {
          return Promise.resolve(mockSubFiles);
        }
        return Promise.reject(new Error('Directory not found'));
      });

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/dir' || filePath === '/test/dir/subdir') {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('file1.ts') || filePath.includes('file2.ts') || 
            filePath.includes('file3.js')) {
          return Promise.resolve(mockFileStats);
        }
        return Promise.reject(new Error('File not found'));
      });

      const pattern = /\.ts$/;
      const result = await getFilesByPattern('/test/dir', pattern, true);

      expect(result).toContain(path.join('/test/dir', 'file1.ts'));
      expect(result).toContain(path.join('/test/dir', 'subdir', 'file2.ts'));
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not search recursively when recursive is false', async () => {
      const mockFiles = ['file1.ts', 'subdir'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/dir') {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('subdir')) {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('file1.ts')) {
          return Promise.resolve(mockFileStats);
        }
        return Promise.reject(new Error('File not found'));
      });

      const pattern = /\.ts$/;
      const result = await getFilesByPattern('/test/dir', pattern, false);

      expect(result).toEqual([path.join('/test/dir', 'file1.ts')]);
    });

    it('should handle file reading errors gracefully', async () => {
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.ts']);
      fs.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await getFilesByPattern('/test/dir', /\.ts$/);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle directory reading errors gracefully', async () => {
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await getFilesByPattern('/test/dir', /\.ts$/);

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('读取目录时出错: /test/dir', 'Permission denied');
    });

    it('should return empty array when no files match pattern', async () => {
      const mockFiles = ['file1.js', 'file2.txt', 'file3.json'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/dir') {
          return Promise.resolve(mockDirStats);
        }
        return Promise.resolve(mockFileStats);
      });

      const pattern = /\.ts$/;
      const result = await getFilesByPattern('/test/dir', pattern);

      expect(result).toEqual([]);
    });

    it('should handle empty directory', async () => {
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([]);

      const result = await getFilesByPattern('/empty/dir', /\.ts$/);

      expect(result).toEqual([]);
    });
  });

  describe('listLibs', () => {
    it('should call getFilesByPattern with d.ts pattern', async () => {
      const mockFiles = ['lib.d.ts', 'file.js', 'test.d.ts', 'node.d.ts'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/path') {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('lib.d.ts') || filePath.includes('file.js') || 
            filePath.includes('test.d.ts') || filePath.includes('node.d.ts')) {
          return Promise.resolve(mockFileStats);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await listLibs('/test/path');

      expect(result).toEqual([
        path.join('/test/path', 'lib.d.ts'),
        path.join('/test/path', 'test.d.ts'),
        path.join('/test/path', 'node.d.ts')
      ]);
    });

    it('should be case insensitive for .ts extension', async () => {
      const mockFiles = ['lib.D.TS', 'test.d.Ts'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/path') {
          return Promise.resolve(mockDirStats);
        }
        if (filePath.includes('lib.D.TS') || filePath.includes('test.d.Ts')) {
          return Promise.resolve(mockFileStats);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await listLibs('/test/path');

      expect(result).toEqual([
        path.join('/test/path', 'lib.D.TS'),
        path.join('/test/path', 'test.d.Ts')
      ]);
    });

    it('should return empty array when no d.ts files found', async () => {
      const mockFiles = ['file.js', 'test.txt', 'node.json'];
      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true
      };
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(mockFiles);

      fs.stat.mockImplementation((filePath) => {
        if (filePath === '/test/path') {
          return Promise.resolve(mockDirStats);
        }
        return Promise.resolve(mockFileStats);
      });

      const result = await listLibs('/test/path');

      expect(result).toEqual([]);
    });
  });

  describe('listHelperPaths', () => {
    it('should return helper paths structure with correct properties', async () => {
      const harmonyDir = '/harmony/sdk';
      const tsDir = '/ts/lib';
      
      // Mock the file system operations
      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      
      const mockDirStats = {
        isDirectory: () => true,
        isFile: () => false
      };

      fs.stat.mockImplementation((filePath) => {
        return Promise.resolve(mockDirStats);
      });

      const result = await listHelperPaths(tsDir, harmonyDir);

      expect(result).toHaveProperty('sdkPath', harmonyDir);
      expect(result).toHaveProperty('etsComponentPath', path.join(harmonyDir, '/ets/component'));
      expect(result).toHaveProperty('etsLoaderConfigPath', path.join(harmonyDir, '/ets/build-tools/ets-loader/tsconfig.json'));
      expect(result).toHaveProperty('etsLoaderPath', path.join(harmonyDir, '/ets/build-tools/ets-loader'));
      expect(result).toHaveProperty('baseUrl', path.join(harmonyDir, '/ets'));
      expect(result).toHaveProperty('lib');
      expect(result).toHaveProperty('paths');
      expect(result.paths).toEqual({
        "*": ["./api/*", "./kits/*", "./arkts/*"],
        "@internal/full/*": ["./api/@internal/full/*"]
      });
    });
  });
});