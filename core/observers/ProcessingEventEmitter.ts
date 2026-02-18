import {
  IProcessingObservable,
  IProcessingObserver,
  IProcessingEvent,
} from '../interfaces/IVideoProcessing';

/**
 * Observable implementation for processing events
 * Implements Observer pattern to notify subscribers of processing events
 */
export class ProcessingEventEmitter implements IProcessingObservable {
  private observers: Set<IProcessingObserver> = new Set();

  /**
   * Subscribe to processing events
   * @param observer - The observer to notify of events
   */
  subscribe(observer: IProcessingObserver): void {
    this.observers.add(observer);
  }

  /**
   * Unsubscribe from processing events
   * @param observer - The observer to remove
   */
  unsubscribe(observer: IProcessingObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Notify all observers of an event
   * @param event - The event to emit
   */
  notify(event: IProcessingEvent): void {
    this.observers.forEach((observer) => {
      try {
        observer.onEvent(event);
      } catch (error) {
        console.error('Observer error:', error);
      }
    });
  }

  /**
   * Clear all observers
   */
  clear(): void {
    this.observers.clear();
  }
}
