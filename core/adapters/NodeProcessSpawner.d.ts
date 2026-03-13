import { IProcessSpawner } from '../interfaces/IVideoProcessing';
/**
 * Node.js child_process spawner implementation
 * Abstracts process spawning to enable dependency injection and testing
 */
export declare class NodeProcessSpawner implements IProcessSpawner {
    /**
     * Spawn a child process
     * @param command - Command to execute
     * @param args - Command arguments
     * @returns Promise resolving to process output
     */
    spawn(command: string, args: string[]): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}
//# sourceMappingURL=NodeProcessSpawner.d.ts.map