"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.Container = void 0;
/**
 * Simple Dependency Injection Container
 * This is framework-agnostic and can be used in any TypeScript application
 */
class Container {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }
    /**
     * Register a service factory
     */
    register(key, factory, singleton = false) {
        this.services.set(key, factory);
        if (singleton) {
            this.singletons.set(key, null);
        }
    }
    /**
     * Resolve a service instance
     */
    resolve(key) {
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
    has(key) {
        return this.services.has(key);
    }
    /**
     * Clear all services
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
    }
}
exports.Container = Container;
// Export singleton container instance
exports.container = new Container();
//# sourceMappingURL=container.js.map