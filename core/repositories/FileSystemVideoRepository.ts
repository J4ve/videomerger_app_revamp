import {
  IVideoRepository,
  IVideoMetadata,
  IVideoProcessingResult,
  IAppConfig,
} from '../interfaces/IVideoProcessing';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File system based video repository
 * Demonstrates Repository pattern - abstracts data access behind interface
 * Uses injected configuration for supported formats
 */
export class FileSystemVideoRepository implements IVideoRepository {
  private config: IAppConfig;

  /**
   * Constructor with dependency injection
   * @param config - Injected application configuration
   */
  constructor(config: IAppConfig) {
    this.config = config;
  }

  /**
   * Validate a video file
   * @param filePath - Path to video file
   * @returns Promise resolving to validation result
   */
  async validate(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      const ext = path.extname(filePath).toLowerCase().substring(1);
      return this.config.supportedFormats.includes(ext);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get video metadata
   * @param filePath - Path to video file
   * @returns Promise resolving to video metadata
   */
  async getMetadata(filePath: string): Promise<IVideoMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase().substring(1);

      return {
        path: filePath,
        format: ext,
        size: stats.size,
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${filePath}: ${error}`);
    }
  }

  /**
   * Save video processing result
   * @param result - The processing result to save
   */
  async save(result: IVideoProcessingResult): Promise<void> {
    if (result.success && result.outputPath) {
      try {
        await fs.access(result.outputPath);
      } catch (error) {
        throw new Error(`Output file not found: ${result.outputPath}`);
      }
    }
  }
}
