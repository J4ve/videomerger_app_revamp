import {
  IFFmpegAdapter,
  IVideoMergeOptions,
  IVideoProcessingResult,
} from '../interfaces/IVideoProcessing';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

/**
 * Adapter for Python FFmpeg integration
 * Spawns Python child process to handle FFmpeg operations
 */
export class PythonFFmpegAdapter implements IFFmpegAdapter {
  private pythonPath: string;
  private scriptPath: string;

  constructor(pythonPath: string = 'python', scriptPath?: string) {
    this.pythonPath = pythonPath;
    this.scriptPath =
      scriptPath ||
      path.join(__dirname, '../../src/videomerger/video_processor_cli.py');
  }

  /**
   * Check if FFmpeg is available by calling Python script
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executePythonScript(['--check-ffmpeg']);
      return result.stdout.includes('available');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get FFmpeg version
   */
  async getVersion(): Promise<string> {
    try {
      const result = await this.executePythonScript(['--version']);
      return result.stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Execute FFmpeg command via Python
   */
  async execute(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return this.executePythonScript(['--execute', ...args]);
  }

  /**
   * Merge videos using Python FFmpeg wrapper
   */
  async mergeVideos(
    options: IVideoMergeOptions
  ): Promise<IVideoProcessingResult> {
    try {
      const args = [
        '--merge',
        '--inputs',
        ...options.inputPaths,
        '--output',
        options.outputPath,
      ];

      if (options.quality) {
        args.push('--quality', options.quality);
      }

      if (options.overwrite) {
        args.push('--overwrite');
      }

      const result = await this.executePythonScript(args);

      return {
        success: true,
        outputPath: options.outputPath,
        metadata: {
          path: options.outputPath,
          size: 0, // Will be populated by file system
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute Python script with arguments
   */
  private executePythonScript(
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [this.scriptPath, ...args]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}
