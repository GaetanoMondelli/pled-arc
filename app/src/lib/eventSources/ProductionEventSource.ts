/**
 * Production Event Source
 * 
 * Connects to real-time event streams:
 * - Kafka
 * - WebSockets
 * - Server-Sent Events
 * - HTTP APIs
 * 
 * Converts external events into internal StoredEvent format
 * and feeds them to the event processor.
 * 
 * @module ProductionEventSource
 */

import { StoredEvent, createEvent, useEventStore } from '@/stores/eventStore';
import { useEventQueue } from '@/stores/eventQueue';
import { useEventProcessor } from '../executionEngines/EventProcessor';

/**
 * Event source configuration
 */
export interface ProductionSourceConfig {
  /** Source type */
  type: 'kafka' | 'websocket' | 'sse' | 'http';
  
  /** Connection details */
  connection: {
    url?: string;
    topic?: string;
    headers?: Record<string, string>;
  };
  
  /** Node mapping (external ID -> internal node ID) */
  nodeMapping: Record<string, string>;
  
  /** Transform external event to internal format */
  transform?: (externalEvent: any) => Omit<StoredEvent, 'id'>;
}

/**
 * Production Event Source
 */
export class ProductionEventSource {
  private config: ProductionSourceConfig;
  private isConnected = false;
  private connection: any = null;
  
  constructor(config: ProductionSourceConfig) {
    this.config = config;
  }
  
  /**
   * Start listening to external events
   */
  async start(): Promise<void> {
    switch (this.config.type) {
      case 'kafka':
        await this.startKafkaConsumer();
        break;
      
      case 'websocket':
        await this.startWebSocket();
        break;
      
      case 'sse':
        await this.startSSE();
        break;
      
      case 'http':
        await this.startPolling();
        break;
      
      default:
        throw new Error(`Unknown source type: ${this.config.type}`);
    }
    
    console.log(`✅ Production event source started (${this.config.type})`);
  }
  
  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    this.isConnected = false;
    
    if (this.connection) {
      // Clean up connection based on type
      switch (this.config.type) {
        case 'websocket':
          this.connection.close();
          break;
        
        case 'sse':
          this.connection.close();
          break;
        
        default:
          // Kafka/HTTP cleanup
          break;
      }
    }
    
    console.log(`⏹️ Production event source stopped`);
  }
  
  /**
   * Process incoming external event
   */
  private async processExternalEvent(externalEvent: any): Promise<void> {
    try {
      // Transform to internal format
      const internalEvent = this.config.transform
        ? this.config.transform(externalEvent)
        : this.defaultTransform(externalEvent);
      
      // Add to event store
      const eventStore = useEventStore.getState();
      const storedEvent = eventStore.appendEvent(internalEvent);
      
      // Add to event queue
      const eventQueue = useEventQueue.getState();
      eventQueue.enqueue(storedEvent);
      
      // Process immediately (production mode)
      const processor = useEventProcessor.getState();
      await processor.processEvent(storedEvent);
      
    } catch (error) {
      console.error('❌ Error processing external event:', error);
    }
  }
  
  /**
   * Default transformation (can be overridden)
   */
  private defaultTransform(externalEvent: any): Omit<StoredEvent, 'id'> {
    // Extract or map node ID
    const externalNodeId = externalEvent.nodeId || externalEvent.source;
    const nodeId = this.config.nodeMapping[externalNodeId] || externalNodeId;
    
    return createEvent(
      'ExternalInput',
      nodeId,
      externalEvent.data || externalEvent,
      {
        timestamp: externalEvent.timestamp || Date.now(),
        metadata: {
          context: 'production',
          triggeredBy: externalEvent.userId || 'system',
          tags: ['external', this.config.type],
        },
      }
    );
  }
  
  // ============================================================================
  // SOURCE-SPECIFIC IMPLEMENTATIONS
  // ============================================================================
  
  /**
   * Kafka consumer (placeholder - requires kafka library)
   */
  private async startKafkaConsumer(): Promise<void> {
    // In production, use actual Kafka client:
    // import { Kafka } from 'kafkajs';
    
    /*
    const kafka = new Kafka({
      clientId: 'event-processor',
      brokers: [this.config.connection.url!],
    });
    
    const consumer = kafka.consumer({ groupId: 'event-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: this.config.connection.topic! });
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        const externalEvent = JSON.parse(message.value.toString());
        await this.processExternalEvent(externalEvent);
      },
    });
    
    this.connection = consumer;
    */
    
    console.log('⚠️ Kafka consumer not implemented (placeholder)');
    this.isConnected = true;
  }
  
  /**
   * WebSocket connection
   */
  private async startWebSocket(): Promise<void> {
    const ws = new WebSocket(this.config.connection.url!);
    
    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      this.isConnected = true;
    };
    
    ws.onmessage = async (event) => {
      try {
        const externalEvent = JSON.parse(event.data);
        await this.processExternalEvent(externalEvent);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.isConnected = false;
    };
    
    this.connection = ws;
  }
  
  /**
   * Server-Sent Events
   */
  private async startSSE(): Promise<void> {
    const eventSource = new EventSource(this.config.connection.url!);
    
    eventSource.onopen = () => {
      console.log('📡 SSE connected');
      this.isConnected = true;
    };
    
    eventSource.onmessage = async (event) => {
      try {
        const externalEvent = JSON.parse(event.data);
        await this.processExternalEvent(externalEvent);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
    };
    
    this.connection = eventSource;
  }
  
  /**
   * HTTP polling
   */
  private async startPolling(): Promise<void> {
    this.isConnected = true;
    
    const poll = async () => {
      if (!this.isConnected) return;
      
      try {
        const response = await fetch(this.config.connection.url!, {
          headers: this.config.connection.headers,
        });
        
        const events = await response.json();
        
        // Process batch of events
        if (Array.isArray(events)) {
          for (const event of events) {
            await this.processExternalEvent(event);
          }
        } else {
          await this.processExternalEvent(events);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
      
      // Poll every 5 seconds
      setTimeout(poll, 5000);
    };
    
    poll();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick setup for WebSocket source
 */
export function createWebSocketSource(
  url: string,
  nodeMapping: Record<string, string>
): ProductionEventSource {
  return new ProductionEventSource({
    type: 'websocket',
    connection: { url },
    nodeMapping,
  });
}

/**
 * Quick setup for Kafka source
 */
export function createKafkaSource(
  brokerUrl: string,
  topic: string,
  nodeMapping: Record<string, string>
): ProductionEventSource {
  return new ProductionEventSource({
    type: 'kafka',
    connection: { url: brokerUrl, topic },
    nodeMapping,
  });
}
