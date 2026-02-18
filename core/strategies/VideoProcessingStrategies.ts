import {
  IVideoProcessingStrategy,
  IVideoMergeOptions,
  IVideoProcessingResult,
  IFFmpegAdapter,
} from '../interfaces/IVideoProcessing';

/**
 * FFmpeg-based video processing strategy
 * Uses FFmpeg for video merging operations
 */
export class FFmpegProcessingStrategy implements IVideoProcessingStrategy {
  private ffmpegAdapter: IFFmpegAdapter;

  constructor(ffmpegAdapter: IFFmpegAdapter) {
    this.ffmpegAdapter = ffmpegAdapter;
  }

  /**
   * Process videos using FFmpeg
   */
  async process(options: IVideoMergeOptions): Promise<IVideoProcessingResult> {
    return this.ffmpegAdapter.mergeVideos(options);
  }
}

/**
 * Alternative strategy that could use a different processing method
 * This demonstrates the Strategy pattern - different implementations can be swapped
 */
export class WebAPIProcessingStrategy implements IVideoProcessingStrategy {
  private apiEndpoint: string;

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Process videos via web API (for future web/mobile implementation)
   */
  async process(options: IVideoMergeOptions): Promise<IVideoProcessingResult> {
    // This would make HTTP requests to a web API
    // Not implemented now, but shows how the architecture supports it
    throw new Error('Web API processing not implemented yet');
  }
}
