import { IContainer } from '../interfaces/IVideoProcessing';
/**
 * Simple Dependency Injection Container
 * This is framework-agnostic and can be used in any TypeScript application
 */
export declare class Container implements IContainer {
    private services;
    private singletons;
    /**
     * Register a service factory
     */
    register<T>(key: string, factory: () => T, singleton?: boolean): void;
    /**
     * Resolve a service instance
     */
    resolve<T>(key: string): T;
    /**
     * Check if a service is registered
     */
    has(key: string): boolean;
    /**
     * Clear all services
     */
    clear(): void;
}
export declare const container: Container;
//# sourceMappingURL=container.d.ts.map