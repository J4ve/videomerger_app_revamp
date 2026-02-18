import {
  IVideoProcessingService,
  IVideoMergeOptions,
  IVideoProcessingResult,
  IVideoMetadata,
  IVideoRepository,
  IVideoProcessingStrategy,
} from '../interfaces/IVideoProcessing';

/**
 * Main video processing service
 * Framework-agnostic core business logic
 */
export class VideoProcessingService implements IVideoProcessingService {
  private repository: IVideoRepository;
  private strategy: IVideoProcessingStrategy;

  constructor(
    repository: IVideoRepository,
    strategy: IVideoProcessingStrategy
  ) {
    this.repository = repository;
    this.strategy = strategy;
  }

  /**
   * Merge multiple videos
   */
  async mergeVideos(
    options: IVideoMergeOptions
  ): Promise<IVideoProcessingResult> {
    // Validate inputs
    if (!options.inputPaths || options.inputPaths.length < 2) {
      return {
        success: false,
        error: 'At least 2 videos are required for merging',
      };
    }

    // Use the strategy to process videos
    return this.strategy.process(options);
  }

  /**
   * Validate video files
   */
  async validateVideos(paths: string[]): Promise<boolean> {
    for (const path of paths) {
      const isValid = await this.repository.validate(path);
      if (!isValid) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get video information
   */
  async getVideoInfo(path: string): Promise<IVideoMetadata> {
    return this.repository.getMetadata(path);
  }
}
