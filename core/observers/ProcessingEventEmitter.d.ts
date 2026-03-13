import { IProcessingObservable, IProcessingObserver, IProcessingEvent } from '../interfaces/IVideoProcessing';
/**
 * Observable implementation for processing events
 * Implements Observer pattern to notify subscribers of processing events
 */
export declare class ProcessingEventEmitter implements IProcessingObservable {
    private observers;
    /**
     * Subscribe to processing events
     * @param observer - The observer to notify of events
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
    /**
     * Clear all observers
     */
    clear(): void;
}
//# sourceMappingURL=ProcessingEventEmitter.d.ts.map