import {
  IVideoProcessingService,
  IVideoMergeOptions,
  IVideoProcessingResult,
  IVideoMetadata,
  IVideoRepository,
  IVideoProcessingStrategy,
  IProcessingObserver,
  IProcessingEvent,
} from '../interfaces/IVideoProcessing';
import { ProcessingEventEmitter } from '../observers/ProcessingEventEmitter';

/**
 * Main video processing service
 * Contains framework-agnostic business logic
 * Implements Observer pattern to notify subscribers of processing events
 */
export class VideoProcessingService implements IVideoProcessingService {
  private repository: IVideoRepository;
  private strategy: IVideoProcessingStrategy;
  private eventEmitter: ProcessingEventEmitter;

  /**
   * Constructor with dependency injection
   * @param repository - Injected video repository
   * @param strategy - Injected processing strategy
   */
  constructor(
    repository: IVideoRepository,
    strategy: IVideoProcessingStrategy
  ) {
    this.repository = repository;
    this.strategy = strategy;
    this.eventEmitter = new ProcessingEventEmitter();
  }

  /**
   * Merge multiple videos
   * @param options - Merge options
   * @returns Promise resolving to processing result
   */
  async mergeVideos(
    options: IVideoMergeOptions
  ): Promise<IVideoProcessingResult> {
    if (!options.inputPaths || options.inputPaths.length < 2) {
      const error = new Error('At least 2 videos are required for merging');
      this.emitEvent({
        type: 'error',
        message: error.message,
        error,
      });
      return {
        success: false,
        error: error.message,
      };
    }

    this.emitEvent({
      type: 'started',
      message: 'Starting video merge process',
    });

    try {
      let lastProgress = 0;
      const result = await this.strategy.process(options, (output) => {
        // A single stream chunk may contain multiple PROGRESS markers.
        // Parse all and keep the highest one observed in this chunk.
        const progressMatches = Array.from(output.matchAll(/PROGRESS:\s*(\d{1,3})/gi));
        if (progressMatches.length > 0) {
          let highestInChunk = lastProgress;
          for (const match of progressMatches) {
            const parsed = Number.parseInt(match[1], 10);
            if (!Number.isFinite(parsed)) continue;
            const clamped = Math.max(0, Math.min(100, parsed));
            if (clamped > highestInChunk) {
              highestInChunk = clamped;
            }
          }

          if (highestInChunk > lastProgress) {
            lastProgress = highestInChunk;
            this.emitEvent({
              type: 'progress',
              message: `Processing: ${lastProgress}%`,
              progress: lastProgress,
            });
          }
        }

        // Keep useful processing status text flowing to the UI.
        const infoMatch = output.match(/INFO:\s*(.+)/i);
        if (infoMatch?.[1]) {
          this.emitEvent({
            type: 'progress',
            message: infoMatch[1].trim(),
            progress: lastProgress,
          });
        }
      });

      if (result.success) {
        this.emitEvent({
          type: 'complete',
          message: 'Video merge completed successfully',
          result,
        });
      } else {
        this.emitEvent({
          type: 'error',
          message: result.error || 'Merge failed',
          error: new Error(result.error),
        });
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.emitEvent({
        type: 'error',
        message: errorMessage,
        error: error instanceof Error ? error : new Error(errorMessage),
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate video files
   * @param paths - Array of file paths
   * @returns Promise resolving to validation result
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
   * @param path - Path to video file
   * @returns Promise resolving to video metadata
   */
  async getVideoInfo(path: string): Promise<IVideoMetadata> {
    return this.repository.getMetadata(path);
  }

  /**
   * Subscribe to processing events
   * @param observer - Observer to notify
   */
  subscribe(observer: IProcessingObserver): void {
    this.eventEmitter.subscribe(observer);
  }

  /**
   * Unsubscribe from processing events
   * @param observer - Observer to remove
   */
  unsubscribe(observer: IProcessingObserver): void {
    this.eventEmitter.unsubscribe(observer);
  }

  /**
   * Emit processing event to all observers
   * @param event - Event to emit
   */
  private emitEvent(event: IProcessingEvent): void {
    this.eventEmitter.notify(event);
  }
}
