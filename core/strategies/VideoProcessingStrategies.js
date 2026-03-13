"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebAPIProcessingStrategy = exports.FFmpegProcessingStrategy = void 0;
/**
 * FFmpeg-based video processing strategy
 * Uses FFmpeg for video merging operations
 */
class FFmpegProcessingStrategy {
    constructor(ffmpegAdapter) {
        this.ffmpegAdapter = ffmpegAdapter;
    }
    /**
     * Process videos using FFmpeg
     */
    async process(options) {
        return this.ffmpegAdapter.mergeVideos(options);
    }
}
exports.FFmpegProcessingStrategy = FFmpegProcessingStrategy;
/**
 * Alternative strategy that could use a different processing method
 * This demonstrates the Strategy pattern - different implementations can be swapped
 */
class WebAPIProcessingStrategy {
    constructor(apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
    }
    /**
     * Process videos via web API (for future web/mobile implementation)
     */
    async process(options) {
        // This would make HTTP requests to a web API
        // Not implemented now, but shows how the architecture supports it
        throw new Error('Web API processing not implemented yet');
    }
}
exports.WebAPIProcessingStrategy = WebAPIProcessingStrategy;
//# sourceMappingURL=VideoProcessingStrategies.js.map