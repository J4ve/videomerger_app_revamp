"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeVideosCommand = void 0;
/**
 * Command for merging videos
 * Implements the Command pattern for video merge operations
 */
class MergeVideosCommand {
    constructor(options, ffmpegAdapter, repository) {
        this.options = options;
        this.ffmpegAdapter = ffmpegAdapter;
        this.repository = repository;
    }
    /**
     * Execute the merge command
     */
    async execute() {
        try {
            // Validate all input videos
            for (const inputPath of this.options.inputPaths) {
                const isValid = await this.repository.validate(inputPath);
                if (!isValid) {
                    return {
                        success: false,
                        error: `Invalid video file: ${inputPath}`,
                    };
                }
            }
            // Check FFmpeg availability
            const ffmpegAvailable = await this.ffmpegAdapter.isAvailable();
            if (!ffmpegAvailable) {
                return {
                    success: false,
                    error: 'FFmpeg is not available',
                };
            }
            // Execute merge operation
            const result = await this.ffmpegAdapter.mergeVideos(this.options);
            // Save result
            if (result.success) {
                await this.repository.save(result);
            }
            else {
                await this.repository.deleteFile(this.options.outputPath);
            }
            return result;
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Undo the merge (delete output file)
     */
    async undo() {
        // Implementation for undo would delete the output file
        // Not implemented in this version
    }
}
exports.MergeVideosCommand = MergeVideosCommand;
//# sourceMappingURL=MergeVideosCommand.js.map