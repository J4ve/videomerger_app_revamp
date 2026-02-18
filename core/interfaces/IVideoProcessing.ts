/**
 * Core interfaces for video processing - Framework agnostic
 * These interfaces define the contracts for video processing operations
 */

/**
 * Video metadata information
 */
export interface IVideoMetadata {
  path: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  format?: string;
  size: number;
}

/**
 * Video processing result
 */
export interface IVideoProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  metadata?: IVideoMetadata;
}

/**
 * Video merge options
 */
export interface IVideoMergeOptions {
  inputPaths: string[];
  outputPath: string;
  quality?: 'low' | 'medium' | 'high';
  overwrite?: boolean;
}

/**
 * Repository pattern for video operations
 */
export interface IVideoRepository {
  /**
   * Validate a video file
   */
  validate(path: string): Promise<boolean>;

  /**
   * Get video metadata
   */
  getMetadata(path: string): Promise<IVideoMetadata>;

  /**
   * Save video processing result
   */
  save(result: IVideoProcessingResult): Promise<void>;
}

/**
 * Command pattern for video processing operations
 */
export interface ICommand {
  /**
   * Execute the command
   */
  execute(): Promise<IVideoProcessingResult>;

  /**
   * Undo the command (if supported)
   */
  undo?(): Promise<void>;
}

/**
 * Strategy pattern for different video processing strategies
 */
export interface IVideoProcessingStrategy {
  /**
   * Process videos according to the strategy
   */
  process(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}

/**
 * Adapter pattern for FFmpeg integration
 */
export interface IFFmpegAdapter {
  /**
   * Check if FFmpeg is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get FFmpeg version
   */
  getVersion(): Promise<string>;

  /**
   * Execute FFmpeg command
   */
  execute(args: string[]): Promise<{ stdout: string; stderr: string }>;

  /**
   * Merge videos using FFmpeg
   */
  mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}

/**
 * Service for video processing operations
 */
export interface IVideoProcessingService {
  /**
   * Merge multiple videos
   */
  mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;

  /**
   * Validate video files
   */
  validateVideos(paths: string[]): Promise<boolean>;

  /**
   * Get video information
   */
  getVideoInfo(path: string): Promise<IVideoMetadata>;
}

/**
 * Dependency injection container interface
 */
export interface IContainer {
  /**
   * Register a service
   */
  register<T>(key: string, factory: () => T): void;

  /**
   * Resolve a service
   */
  resolve<T>(key: string): T;
}
