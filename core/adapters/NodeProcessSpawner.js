"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeProcessSpawner = void 0;
const child_process_1 = require("child_process");
/**
 * Node.js child_process spawner implementation
 * Abstracts process spawning to enable dependency injection and testing
 */
class NodeProcessSpawner {
    /**
     * Spawn a child process
     * @param command - Command to execute
     * @param args - Command arguments
     * @returns Promise resolving to process output
     */
    async spawn(command, args) {
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(command, args);
            let stdout = '';
            let stderr = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', (code) => {
                resolve({
                    stdout,
                    stderr,
                    exitCode: code || 0,
                });
            });
            process.on('error', (error) => {
                reject(error);
            });
        });
    }
}
exports.NodeProcessSpawner = NodeProcessSpawner;
//# sourceMappingURL=NodeProcessSpawner.js.map