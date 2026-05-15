import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  IFFmpegAdapter,
  IVideoMergeOptions,
  IVideoProcessingResult,
  IProcessSpawner,
  IAppConfig,
} from '../interfaces/IVideoProcessing';

/**
 * Adapter for Python FFmpeg integration
 * Uses injected process spawner to communicate with Python child process
 * Demonstrates Adapter pattern - wraps external Python process communication
 */
export class PythonFFmpegAdapter implements IFFmpegAdapter {
  private processSpawner: IProcessSpawner;
  private config: IAppConfig;

  /**
   * Constructor with dependency injection
   * @param processSpawner - Injected process spawner for creating child processes
   * @param config - Injected application configuration
   */
  constructor(processSpawner: IProcessSpawner, config: IAppConfig) {
    this.processSpawner = processSpawner;
    this.config = config;
  }

  /**
   * Check if FFmpeg is available by calling Python script
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executePythonScript(['--check-ffmpeg']);
      return result.exitCode === 0 && result.stdout.includes('available');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get FFmpeg version
   * @returns Promise resolving to version string
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
   * @param args - Command arguments
   * @returns Promise resolving to command output
   */
  async execute(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const result = await this.executePythonScript(['--execute', ...args]);
    return { stdout: result.stdout, stderr: result.stderr };
  }

  /**
   * Merge videos using Python FFmpeg wrapper
   * @param options - Merge options
   * @returns Promise resolving to processing result
   */
  async mergeVideos(
    options: IVideoMergeOptions,
    onProgress?: (output: string) => void
  ): Promise<IVideoProcessingResult> {
    let clipsJsonPath: string | undefined;
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

      if (options.clipEdits && options.clipEdits.length > 0) {
        clipsJsonPath = this.writeClipsJson(options);
        args.push('--clips-json', clipsJsonPath);
      }

      if (options.loudnorm?.enabled) {
        args.push('--loudnorm');
        if (typeof options.loudnorm.targetLufs === 'number') {
          args.push('--loudnorm-target', String(options.loudnorm.targetLufs));
        }
        if (typeof options.loudnorm.truePeak === 'number') {
          args.push(
            '--loudnorm-true-peak',
            String(options.loudnorm.truePeak),
          );
        }
        if (typeof options.loudnorm.loudnessRange === 'number') {
          args.push('--loudnorm-lra', String(options.loudnorm.loudnessRange));
        }
      }

      if (options.autoSilenceTrim?.enabled) {
        args.push('--auto-silence-trim');
        if (typeof options.autoSilenceTrim.thresholdDb === 'number') {
          args.push(
            '--silence-threshold-db',
            String(options.autoSilenceTrim.thresholdDb),
          );
        }
        if (typeof options.autoSilenceTrim.minDurationSec === 'number') {
          args.push(
            '--silence-min-duration',
            String(options.autoSilenceTrim.minDurationSec),
          );
        }
      }

      const result = await this.executePythonScript(args, onProgress, onProgress);

      if (result.exitCode === 0) {
        return {
          success: true,
          outputPath: options.outputPath,
          metadata: {
            path: options.outputPath,
            size: 0,
          },
        };
      } else {
        return {
          success: false,
          error: result.stderr || 'Unknown error occurred',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (clipsJsonPath) {
        fs.promises.unlink(clipsJsonPath).catch(() => undefined);
      }
    }
  }

  /**
   * Serialize per-clip edits to a temp JSON file consumed by the Python CLI.
   * Passing via file (not argv) avoids OS arg-length limits when many clips
   * have complex edits and keeps quoting concerns off the command line.
   */
  private writeClipsJson(options: IVideoMergeOptions): string {
    const payload = {
      clips: options.inputPaths.map((p, i) => ({
        path: p,
        edits: options.clipEdits?.[i] ?? {},
      })),
    };
    const tmpFile = path.join(
      os.tmpdir(),
      `videomerger_clips_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`,
    );
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf-8');
    return tmpFile;
  }

  /**
   * Execute Python script with arguments using injected process spawner
   * @param args - Script arguments
   * @returns Promise resolving to process output
   */
  private executePythonScript(
    args: string[],
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // -u keeps stdout/stderr unbuffered so progress reaches renderer in real time.
    const pythonArgs = ['-u', this.config.pythonScriptPath];
    
    if (this.config.ffmpegPath) {
      pythonArgs.push('--ffmpeg-path', this.config.ffmpegPath);
    }
    
    pythonArgs.push(...args);

    return this.processSpawner.spawn(
      this.config.pythonPath, 
      pythonArgs,
      onStdout,
      onStderr
    );
  }
}
