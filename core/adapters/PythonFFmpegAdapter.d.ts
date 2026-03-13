import { IFFmpegAdapter, IVideoMergeOptions, IVideoProcessingResult, IProcessSpawner, IAppConfig } from '../interfaces/IVideoProcessing';
/**
 * Adapter for Python FFmpeg integration
 * Uses injected process spawner to communicate with Python child process
 * Demonstrates Adapter pattern - wraps external Python process communication
 */
export declare class PythonFFmpegAdapter implements IFFmpegAdapter {
    private processSpawner;
    private config;
    /**
     * Constructor with dependency injection
     * @param processSpawner - Injected process spawner for creating child processes
     * @param config - Injected application configuration
     */
    constructor(processSpawner: IProcessSpawner, config: IAppConfig);
    /**
     * Check if FFmpeg is available by calling Python script
     * @returns Promise resolving to availability status
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get FFmpeg version
     * @returns Promise resolving to version string
     */
    getVersion(): Promise<string>;
    /**
     * Execute FFmpeg command via Python
     * @param args - Command arguments
     * @returns Promise resolving to command output
     */
    execute(args: string[]): Promise<{
        stdout: string;
        stderr: string;
    }>;
    /**
     * Merge videos using Python FFmpeg wrapper
     * @param options - Merge options
     * @returns Promise resolving to processing result
     */
    mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
    /**
     * Execute Python script with arguments using injected process spawner
     * @param args - Script arguments
     * @returns Promise resolving to process output
     */
    private executePythonScript;
}
//# sourceMappingURL=PythonFFmpegAdapter.d.ts.map