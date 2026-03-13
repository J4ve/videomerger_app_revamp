import { IVideoRepository, IVideoMetadata, IVideoProcessingResult, IAppConfig } from '../interfaces/IVideoProcessing';
/**
 * File system based video repository
 * Demonstrates Repository pattern - abstracts data access behind interface
 * Uses injected configuration for supported formats
 */
export declare class FileSystemVideoRepository implements IVideoRepository {
    private config;
    /**
     * Constructor with dependency injection
     * @param config - Injected application configuration
     */
    constructor(config: IAppConfig);
    /**
     * Validate a video file
     * @param filePath - Path to video file
     * @returns Promise resolving to validation result
     */
    validate(filePath: string): Promise<boolean>;
    /**
     * Get video metadata
     * @param filePath - Path to video file
     * @returns Promise resolving to video metadata
     */
    getMetadata(filePath: string): Promise<IVideoMetadata>;
    /**
     * Save video processing result
     * @param result - The processing result to save
     */
    save(result: IVideoProcessingResult): Promise<void>;
    /**
     * Delete a file
     * @param filePath - Path to the file
     */
    deleteFile(filePath: string): Promise<void>;
}
//# sourceMappingURL=FileSystemVideoRepository.d.ts.map