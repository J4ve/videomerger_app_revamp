import { ICommand, IVideoMergeOptions, IVideoProcessingResult, IFFmpegAdapter, IVideoRepository } from '../interfaces/IVideoProcessing';
/**
 * Command for merging videos
 * Implements the Command pattern for video merge operations
 */
export declare class MergeVideosCommand implements ICommand {
    private options;
    private ffmpegAdapter;
    private repository;
    constructor(options: IVideoMergeOptions, ffmpegAdapter: IFFmpegAdapter, repository: IVideoRepository);
    /**
     * Execute the merge command
     */
    execute(): Promise<IVideoProcessingResult>;
    /**
     * Undo the merge (delete output file)
     */
    undo(): Promise<void>;
}
//# sourceMappingURL=MergeVideosCommand.d.ts.map