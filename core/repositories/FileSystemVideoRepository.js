"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemVideoRepository = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * File system based video repository
 * Demonstrates Repository pattern - abstracts data access behind interface
 * Uses injected configuration for supported formats
 */
class FileSystemVideoRepository {
    /**
     * Constructor with dependency injection
     * @param config - Injected application configuration
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Validate a video file
     * @param filePath - Path to video file
     * @returns Promise resolving to validation result
     */
    async validate(filePath) {
        try {
            await fs.access(filePath);
            const ext = path.extname(filePath).toLowerCase().substring(1);
            if (!this.config.supportedFormats.includes(ext)) {
                return false;
            }
            const stats = await fs.stat(filePath);
            if (this.config.maxFileSizeMb && stats.size > this.config.maxFileSizeMb * 1024 * 1024) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get video metadata
     * @param filePath - Path to video file
     * @returns Promise resolving to video metadata
     */
    async getMetadata(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const ext = path.extname(filePath).toLowerCase().substring(1);
            return {
                path: filePath,
                format: ext,
                size: stats.size,
            };
        }
        catch (error) {
            throw new Error(`Failed to get metadata for ${filePath}: ${error}`);
        }
    }
    /**
     * Save video processing result
     * @param result - The processing result to save
     */
    async save(result) {
        if (result.success && result.outputPath) {
            try {
                await fs.access(result.outputPath);
            }
            catch (error) {
                throw new Error(`Output file not found: ${result.outputPath}`);
            }
        }
    }
    /**
     * Delete a file
     * @param filePath - Path to the file
     */
    async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            // Ignore errors if file doesn't exist
        }
    }
}
exports.FileSystemVideoRepository = FileSystemVideoRepository;
//# sourceMappingURL=FileSystemVideoRepository.js.map