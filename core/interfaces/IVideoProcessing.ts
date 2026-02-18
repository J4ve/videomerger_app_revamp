/**
 * Core interfaces for video processing application
 * These interfaces define contracts between layers and enable dependency injection
 * Framework-agnostic design allows reuse in web APIs or other platforms
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
 * Processing event types for Observer pattern
 */
export type ProcessingEventType = 'progress' | 'complete' | 'error' | 'started';

/**
 * Processing event data
 */
export interface IProcessingEvent {
  type: ProcessingEventType;
  progress?: number;
  message?: string;
  error?: Error;
  result?: IVideoProcessingResult;
}

/**
 * Observer interface for subscribing to processing events
 */
export interface IProcessingObserver {
  /**
   * Called when a processing event occurs
   * @param event - The processing event
   */
  onEvent(event: IProcessingEvent): void;
}

/**
 * Observable interface for emitting processing events
 */
export interface IProcessingObservable {
  /**
   * Subscribe to processing events
   * @param observer - The observer to notify
   */
  subscribe(observer: IProcessingObserver): void;

  /**
   * Unsubscribe from processing events
   * @param observer - The observer to remove
   */
  unsubscribe(observer: IProcessingObserver): void;

  /**
   * Notify all observers of an event
   * @param event - The event to emit
   */
  notify(event: IProcessingEvent): void;
}

/**
 * Repository pattern for video file operations
 * Abstracts file system access behind an interface
 */
export interface IVideoRepository {
  /**
   * Validate a video file
   * @param path - Path to the video file
   * @returns Promise resolving to validation result
   */
  validate(path: string): Promise<boolean>;

  /**
   * Get video metadata
   * @param path - Path to the video file
   * @returns Promise resolving to video metadata
   */
  getMetadata(path: string): Promise<IVideoMetadata>;

  /**
   * Save video processing result
   * @param result - The processing result to save
   */
  save(result: IVideoProcessingResult): Promise<void>;
}

/**
 * Command pattern for video processing operations
 * Encapsulates operations as objects that can be queued, logged, or undone
 */
export interface ICommand {
  /**
   * Execute the command
   * @returns Promise resolving to processing result
   */
  execute(): Promise<IVideoProcessingResult>;

  /**
   * Undo the command if supported
   * @returns Promise resolving when undo is complete
   */
  undo?(): Promise<void>;
}

/**
 * Strategy pattern for different video processing strategies
 * Allows swapping processing methods (local FFmpeg, cloud API, etc.)
 */
export interface IVideoProcessingStrategy {
  /**
   * Process videos according to the strategy
   * @param options - Merge options
   * @returns Promise resolving to processing result
   */
  process(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}

/**
 * Adapter pattern for FFmpeg integration
 * Wraps external FFmpeg process communication
 */
export interface IFFmpegAdapter {
  /**
   * Check if FFmpeg is available
   * @returns Promise resolving to availability status
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get FFmpeg version
   * @returns Promise resolving to version string
   */
  getVersion(): Promise<string>;

  /**
   * Execute FFmpeg command
   * @param args - Command arguments
   * @returns Promise resolving to command output
   */
  execute(args: string[]): Promise<{ stdout: string; stderr: string }>;

  /**
   * Merge videos using FFmpeg
   * @param options - Merge options
   * @returns Promise resolving to processing result
   */
  mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;
}

/**
 * Process spawner interface for spawning child processes
 * Abstracts process creation for dependency injection
 */
export interface IProcessSpawner {
  /**
   * Spawn a child process
   * @param command - Command to execute
   * @param args - Command arguments
   * @returns Promise resolving to process output
   */
  spawn(
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

/**
 * Configuration interface for injecting application config
 */
export interface IAppConfig {
  pythonPath: string;
  pythonScriptPath: string;
  supportedFormats: string[];
  tempDir?: string;
}

/**
 * Service for video processing operations
 * Contains framework-agnostic business logic
 */
export interface IVideoProcessingService {
  /**
   * Merge multiple videos
   * @param options - Merge options
   * @returns Promise resolving to processing result
   */
  mergeVideos(options: IVideoMergeOptions): Promise<IVideoProcessingResult>;

  /**
   * Validate video files
   * @param paths - Array of file paths to validate
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
}

/**
 * Dependency injection container interface
 */
export interface IContainer {
  /**
   * Register a service
   * @param key - Service identifier
   * @param factory - Factory function for creating service
   * @param singleton - Whether to create a singleton instance
   */
  register<T>(key: string, factory: () => T, singleton?: boolean): void;

  /**
   * Resolve a service
   * @param key - Service identifier
   * @returns Service instance
   */
  resolve<T>(key: string): T;
}

