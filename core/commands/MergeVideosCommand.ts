import {
  ICommand,
  IVideoMergeOptions,
  IVideoProcessingResult,
  IFFmpegAdapter,
  IVideoRepository,
} from '../interfaces/IVideoProcessing';

/**
 * Command for merging videos
 * Implements the Command pattern for video merge operations
 */
export class MergeVideosCommand implements ICommand {
  private options: IVideoMergeOptions;
  private ffmpegAdapter: IFFmpegAdapter;
  private repository: IVideoRepository;

  constructor(
    options: IVideoMergeOptions,
    ffmpegAdapter: IFFmpegAdapter,
    repository: IVideoRepository
  ) {
    this.options = options;
    this.ffmpegAdapter = ffmpegAdapter;
    this.repository = repository;
  }

  /**
   * Execute the merge command
   */
  async execute(): Promise<IVideoProcessingResult> {
    try {
      // Validate all input videos
      for (const inputPath of this.options.inputPaths) {
        const isValid = await this.repository.validate(inputPath);
        if (!isValid) {
          return {
            success: false,
            error: `Invalid video file: ${inputPath}`,
          };
        }
      }

      // Check FFmpeg availability
      const ffmpegAvailable = await this.ffmpegAdapter.isAvailable();
      if (!ffmpegAvailable) {
        return {
          success: false,
          error: 'FFmpeg is not available',
        };
      }

      // Execute merge operation
      const result = await this.ffmpegAdapter.mergeVideos(this.options);

      // Save result
      if (result.success) {
        await this.repository.save(result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo the merge (delete output file)
   */
  async undo(): Promise<void> {
    // Implementation for undo would delete the output file
    // Not implemented in this version
  }
}
