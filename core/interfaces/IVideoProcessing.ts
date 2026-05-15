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
 * Video standardization settings
 * Applied to all videos being merged to ensure uniform output
 */
export interface IVideoStandardization {
  resolution?: 'original' | '720p' | '1080p' | '4k';
  fps?: 'original' | '24' | '30' | '60';
}

/**
 * Aspect ratio presets for reformatting clips.
 * "original" keeps source aspect, custom uses explicit width:height.
 */
export type AspectRatioPreset =
  | 'original'
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '4:3'
  | 'custom';

/**
 * Crop rectangle (pixels, relative to source frame).
 * x/y are top-left coords; w/h are crop dimensions.
 */
export interface ICropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Per-clip edit options applied during the normalize pass.
 * All fields optional; absent fields skip the corresponding filter.
 */
export interface IClipEdit {
  /** Seconds to skip from start of clip. Defaults to 0. */
  trimStart?: number;
  /** Seconds to skip from end of clip. Defaults to 0. */
  trimEnd?: number;
  /** Audio volume multiplier. 1.0 = unchanged, 0 = mute, 2.0 = double. */
  volume?: number;
  /** Optional explicit crop rectangle (pre-scale). */
  crop?: ICropRect;
  /** Target aspect ratio preset. Drives scale+pad/crop after crop rect. */
  aspectRatio?: AspectRatioPreset;
  /** Custom aspect ratio width (only used if aspectRatio === 'custom'). */
  aspectWidth?: number;
  /** Custom aspect ratio height (only used if aspectRatio === 'custom'). */
  aspectHeight?: number;
  /** Brightness adjustment. Range -1.0 to 1.0. Default 0. */
  brightness?: number;
  /** Contrast adjustment. Range 0 to 2.0. Default 1.0. */
  contrast?: number;
  /** Saturation adjustment. Range 0 to 3.0. Default 1.0. */
  saturation?: number;
}

/**
 * Audio loudness normalization options (EBU R128 / ITU-R BS.1770).
 * When enabled, each clip is loudness-normalized in the normalize pass
 * so concatenated output has consistent perceived loudness across clips.
 */
export interface ILoudnessNormalization {
  /** Master switch. Defaults to false (no loudnorm applied). */
  enabled: boolean;
  /** Integrated loudness target in LUFS. EBU R128 broadcast = -23, streaming platforms ~ -14 to -16. Default -16. */
  targetLufs?: number;
  /** True peak ceiling in dBTP. Default -1.5. */
  truePeak?: number;
  /** Loudness range in LU. Default 11. */
  loudnessRange?: number;
}

/**
 * Automatic silence-trim options. When enabled, a `silencedetect` probe
 * runs against each clip before merging and the detected leading +
 * trailing silence durations are appended to the per-clip trimStart /
 * trimEnd values. Mid-clip silence is intentionally left alone to avoid
 * cutting natural speech pauses.
 */
export interface IAutoSilenceTrim {
  /** Master switch. Defaults to false (no silence trimming). */
  enabled: boolean;
  /** dB level below which audio is treated as silence. Default -50. */
  thresholdDb?: number;
  /** Minimum silence run length in seconds to count. Default 0.5. */
  minDurationSec?: number;
}

/**
 * Faster-whisper model preset. Larger models are more accurate but
 * download a larger file on first use and take longer to transcribe.
 */
export type CaptionModel =
  | 'tiny'
  | 'base'
  | 'small'
  | 'medium'
  | 'large-v3';

/**
 * Auto-caption options. When enabled, each clip is transcribed via
 * faster-whisper and a merged SRT sidecar is written alongside the
 * output video with timestamps offset to the merged timeline.
 */
export interface IAutoCaptions {
  /** Master switch. Defaults to false (no captions). */
  enabled: boolean;
  /** Whisper model size. Default `base` (~74 MB, balance of speed and accuracy). */
  model?: CaptionModel;
  /** ISO 639-1 language code or `auto` to detect. Default `auto`. */
  language?: string;
  /** faster-whisper compute_type. Default `int8` for CPU efficiency. */
  computeType?: 'int8' | 'int8_float16' | 'float16' | 'float32';
}

/**
 * Video merge options
 */
export interface IVideoMergeOptions {
  inputPaths: string[];
  outputPath: string;
  quality?: 'low' | 'medium' | 'high';
  overwrite?: boolean;
  standardization?: IVideoStandardization;
  /**
   * Per-clip edits parallel to inputPaths. Index N applies to inputPaths[N].
   * Length must match inputPaths.length when provided.
   */
  clipEdits?: IClipEdit[];
  /** Global audio loudness normalization applied to all clips. */
  loudnorm?: ILoudnessNormalization;
  /** Auto-detect + remove leading/trailing silence from each clip. */
  autoSilenceTrim?: IAutoSilenceTrim;
  /** Auto-caption the merged output via faster-whisper, writes .srt sidecar. */
  captions?: IAutoCaptions;
}

/**
 * YouTube upload configuration
 */
export interface IYouTubeUploadOptions {
  filePath: string;
  title: string;
  description?: string;
  privacy?: 'public' | 'private' | 'unlisted';
}

/**
 * YouTube upload result
 */
export interface IYouTubeUploadResult {
  success: boolean;
  videoId?: string;
  url?: string;
  error?: string;
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

  /**
   * Delete a file
   * @param path - Path to the file to delete
   */
  deleteFile(path: string): Promise<void>;
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
   * @param onProgress - Optional callback for processing status updates
   * @returns Promise resolving to processing result
   */
  process(
    options: IVideoMergeOptions,
    onProgress?: (output: string) => void
  ): Promise<IVideoProcessingResult>;
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
   * @param onProgress - Optional callback for ffmpeg output line streams
   * @returns Promise resolving to processing result
   */
  mergeVideos(
    options: IVideoMergeOptions,
    onProgress?: (output: string) => void
  ): Promise<IVideoProcessingResult>;
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
   * @param onStdout - Optional callback for stdout stream data
   * @param onStderr - Optional callback for stderr stream data
   * @returns Promise resolving to process output
   */
  spawn(
    command: string,
    args: string[],
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /**
   * Cancel the currently running spawned process, if any
   * @returns true if a process was signaled, false otherwise
   */
  cancelRunningProcess(): boolean;
}

/**
 * Configuration interface for injecting application config
 */
export interface IAppConfig {
  pythonPath: string;
  pythonScriptPath: string;
  supportedFormats: string[];
  tempDir?: string;
  maxFileSizeMb?: number;
  ffmpegPath?: string;
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

