import {
  IVideoRepository,
  IVideoMetadata,
  IVideoProcessingResult,
} from '../interfaces/IVideoProcessing';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File system based video repository
 * Handles video file operations and metadata
 */
export class FileSystemVideoRepository implements IVideoRepository {
  private supportedFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

  /**
   * Validate a video file
   */
  async validate(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Check file extension
      const ext = path.extname(filePath).toLowerCase().substring(1);
      return this.supportedFormats.includes(ext);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get video metadata
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
   * Save video processing result (for logging/history)
   */
  async save(result: IVideoProcessingResult): Promise<void> {
    // This could be extended to save processing history to a database
    // For now, we just ensure the output file exists
    if (result.success && result.outputPath) {
      try {
        await fs.access(result.outputPath);
      } catch (error) {
        throw new Error(`Output file not found: ${result.outputPath}`);
      }
    }
  }
}
