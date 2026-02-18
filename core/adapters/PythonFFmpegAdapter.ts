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
    }
  }

  /**
   * Execute Python script with arguments using injected process spawner
   * @param args - Script arguments
   * @returns Promise resolving to process output
   */
  private executePythonScript(
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.processSpawner.spawn(this.config.pythonPath, [
      this.config.pythonScriptPath,
      ...args,
    ]);
  }
}
