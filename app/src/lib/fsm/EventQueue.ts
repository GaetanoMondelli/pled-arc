import { Event } from './types';

/**
 * Simple Event Queue - Just stores events in order
 */
export class EventQueue {
  private events: Event[] = [];

  addEvent(event: Event): void {
    this.events.push(event);
  }

  addEvents(events: Event[]): void {
    this.events.push(...events);
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  getEventsSince(timestamp: string): Event[] {
    return this.events.filter(event => event.timestamp > timestamp);
  }

  clear(): void {
    this.events = [];
  }

  getLatestEvent(): Event | null {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  size(): number {
    return this.events.length;
  }
}