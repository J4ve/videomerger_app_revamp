import { IVideoProcessingService, IVideoMergeOptions, IVideoProcessingResult, IVideoMetadata, IVideoRepository, IVideoProcessingStrategy, IProcessingObserver } from '../interfaces/IVideoProcessing';
/**
 * Main video processing service
 * Contains framework-agnostic business logic
 * Implements Observer pattern to notify subscribers of processing events
 */
export declare class VideoProcessingService implements IVideoProcessingService {
    private repository;
    private strategy;
    private eventEmitter;
    /**
     * Constructor with dependency injection
     * @param repository - Injected video repository
     * @param strategy - Injected processing strategy
     */
    constructor(repository: IVideoRepository, strategy: IVideoProcessingStrategy);
    /**
     * Merge multiple videos
     * @param options - Merge options
     * @returns Promise resolving to processing result
     */
    mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
    /**
     * Validate video files
     * @param paths - Array of file paths
     * @returns Promise resolving to validation result
     */
    validateVideos(paths: string[]): Promise<boolean>;
    /**
     * Get video information
     * @param path - Path to video file
     * @returns Promise resolving to video metadata
     */
    getVideoInfo(path: string): Promise<IVideoMetadata>;
    /**
     * Subscribe to processing events
     * @param observer - Observer to notify
     */
    subscribe(observer: IProcessingObserver): void;
    /**
     * Unsubscribe from processing events
     * @param observer - Observer to remove
     */
    unsubscribe(observer: IProcessingObserver): void;
    /**
     * Emit processing event to all observers
     * @param event - Event to emit
     */
    private emitEvent;
}
//# sourceMappingURL=VideoProcessingService.d.ts.map