import { Event, Message, Rule } from './types';

/**
 * Event Processor - Transforms events into messages using rules
 */
export class EventProcessor {
  processEvents(events: Event[], rules: Rule[]): Message[] {
    const messages: Message[] = [];

    for (const event of events) {
      const applicableRules = rules.filter(rule =>
        rule.eventType === event.type || rule.eventType === '*'
      );

      for (const rule of applicableRules) {
        // Check condition if exists
        if (rule.condition && !this.evaluateCondition(rule.condition, event)) {
          continue;
        }

        // Transform event to message
        const messageData = rule.transform ? rule.transform(event) : event.data;

        const message: Message = {
          id: `msg_${event.id}_${rule.id}`,
          type: rule.messageType,
          timestamp: event.timestamp,
          data: messageData,
          fromEvent: event.id
        };

        messages.push(message);
      }
    }

    return messages;
  }

  private evaluateCondition(condition: string, event: Event): boolean {
    try {
      // Simple condition evaluation - can be extended
      // For now, just check basic property existence/equality
      if (condition.includes('event.data.')) {
        const prop = condition.replace('event.data.', '');
        return event.data && event.data[prop] !== undefined;
      }
      return true;
    } catch {
      return false;
    }
  }
}