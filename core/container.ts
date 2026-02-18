import { IContainer } from '../interfaces/IVideoProcessing';

/**
 * Simple Dependency Injection Container
 * This is framework-agnostic and can be used in any TypeScript application
 */
export class Container implements IContainer {
  private services: Map<string, () => any> = new Map();
  private singletons: Map<string, any> = new Map();

  /**
   * Register a service factory
   */
  register<T>(key: string, factory: () => T, singleton: boolean = false): void {
    this.services.set(key, factory);
    if (singleton) {
      this.singletons.set(key, null);
    }
  }

  /**
   * Resolve a service instance
   */
  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service not found: ${key}`);
    }

    // Return singleton instance if it exists
    if (this.singletons.has(key)) {
      let instance = this.singletons.get(key);
      if (!instance) {
        instance = factory();
        this.singletons.set(key, instance);
      }
      return instance;
    }

    // Create new instance
    return factory();
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }
}

// Export singleton container instance
export const container = new Container();
