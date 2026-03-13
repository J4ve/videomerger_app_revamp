"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingEventEmitter = void 0;
/**
 * Observable implementation for processing events
 * Implements Observer pattern to notify subscribers of processing events
 */
class ProcessingEventEmitter {
    constructor() {
        this.observers = new Set();
    }
    /**
     * Subscribe to processing events
     * @param observer - The observer to notify of events
     */
    subscribe(observer) {
        this.observers.add(observer);
    }
    /**
     * Unsubscribe from processing events
     * @param observer - The observer to remove
     */
    unsubscribe(observer) {
        this.observers.delete(observer);
    }
    /**
     * Notify all observers of an event
     * @param event - The event to emit
     */
    notify(event) {
        this.observers.forEach((observer) => {
            try {
                observer.onEvent(event);
            }
            catch (error) {
                console.error('Observer error:', error);
            }
        });
    }
    /**
     * Clear all observers
     */
    clear() {
        this.observers.clear();
    }
}
exports.ProcessingEventEmitter = ProcessingEventEmitter;
//# sourceMappingURL=ProcessingEventEmitter.js.map