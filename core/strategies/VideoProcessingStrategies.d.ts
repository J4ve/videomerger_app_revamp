import { IVideoProcessingStrategy, IVideoMergeOptions, IVideoProcessingResult, IFFmpegAdapter } from '../interfaces/IVideoProcessing';
/**
 * FFmpeg-based video processing strategy
 * Uses FFmpeg for video merging operations
 */
export declare class FFmpegProcessingStrategy implements IVideoProcessingStrategy {
    private ffmpegAdapter;
    constructor(ffmpegAdapter: IFFmpegAdapter);
    /**
     * Process videos using FFmpeg
     */
    process(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}
/**
 * Alternative strategy that could use a different processing method
 * This demonstrates the Strategy pattern - different implementations can be swapped
 */
export declare class WebAPIProcessingStrategy implements IVideoProcessingStrategy {
    private apiEndpoint;
    constructor(apiEndpoint: string);
    /**
     * Process videos via web API (for future web/mobile implementation)
     */
    process(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}
//# sourceMappingURL=VideoProcessingStrategies.d.ts.map