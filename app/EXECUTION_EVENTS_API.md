# Execution Events API Documentation

A stream-like API for creating and managing executions with external events in Firebase.

## Overview

The Execution Events API provides a simplified interface for:
- Creating executions with initial events
- Pushing new events to existing executions (stream-like append)
- Fetching events with pagination and filtering

## Endpoints

### 1. Create Execution with Initial Events

**POST** `/api/executions`

Creates a new execution with optional initial external events.

**Request Body:**
```json
{
  "templateId": "template-id",
  "name": "My Execution",
  "description": "Optional description",
  "externalEvents": [
    {
      "id": "event-1",
      "timestamp": 1700000000000,
      "type": "user.signup",
      "source": "api",
      "data": { "userId": "123" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec-abc123",
  "execution": { /* full execution object */ },
  "eventCount": 1
}
```

---

### 2. Get Execution

**GET** `/api/executions/[executionId]`

Retrieves a specific execution with all its data.

**Response:**
```json
{
  "success": true,
  "execution": {
    "id": "exec-abc123",
    "name": "My Execution",
    "templateId": "template-id",
    "externalEvents": [ /* array of events */ ],
    "totalExternalEvents": 5,
    "eventTypes": ["user.signup", "user.login"]
  },
  "eventCount": 5
}
```

---

### 3. Get Execution Events (Stream-like)

**GET** `/api/executions/[executionId]/events`

Fetches the array of external events with pagination and filtering.

**Query Parameters:**
- `offset` (number, default: 0) - Start index for pagination
- `limit` (number, default: 100) - Max events to return
- `type` (string) - Filter by event type
- `since` (number) - Get events after this timestamp (Unix milliseconds)

**Example:**
```
GET /api/executions/exec-abc123/events?limit=10&offset=0
GET /api/executions/exec-abc123/events?type=user.login
GET /api/executions/exec-abc123/events?since=1700000000000
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec-abc123",
  "events": [
    {
      "id": "event-1",
      "timestamp": 1700000000000,
      "type": "user.signup",
      "source": "api",
      "data": { "userId": "123" }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 10,
    "total": 25,
    "hasMore": true,
    "returned": 10
  },
  "metadata": {
    "totalEvents": 25,
    "eventTypes": ["user.signup", "user.login", "order.created"],
    "filters": {
      "type": null,
      "since": null
    }
  }
}
```

---

### 4. Push New Events to Execution

**POST** `/api/executions/[executionId]/events`

Appends new events to an existing execution (stream-like append).

**Request Body:**
```json
{
  "events": [
    {
      "id": "event-new-1",
      "timestamp": 1700000100000,
      "type": "order.created",
      "source": "api",
      "data": { "orderId": "789" }
    },
    {
      "id": "event-new-2",
      "timestamp": 1700000200000,
      "type": "order.completed",
      "source": "api",
      "data": { "orderId": "789" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec-abc123",
  "eventsAdded": 2,
  "totalEvents": 7,
  "newEventTypes": ["user.signup", "user.login", "order.created", "order.completed"],
  "timestamp": 1700000300000
}
```

---

### 5. Delete Execution

**DELETE** `/api/executions/[executionId]`

Deletes a specific execution.

**Response:**
```json
{
  "success": true,
  "message": "Execution exec-abc123 deleted successfully"
}
```

---

### 6. List All Executions

**GET** `/api/executions`

Lists all executions, optionally filtered by template.

**Query Parameters:**
- `templateId` (string) - Filter by template ID

**Example:**
```
GET /api/executions
GET /api/executions?templateId=template-123
```

**Response:**
```json
{
  "success": true,
  "executions": [ /* array of execution objects */ ],
  "count": 10
}
```

---

## Event Structure

Each external event should follow this structure:

```typescript
interface ExternalEvent {
  id: string;              // Unique event identifier
  timestamp: number;       // Unix timestamp in milliseconds
  type: string;            // Event type (e.g., "user.signup")
  source: string;          // Source of the event (e.g., "api", "webhook")
  data: any;               // Event payload (any JSON-serializable data)
  targetDataSourceId?: string;  // Optional: target data source
  nodeId?: string;         // Optional: target node ID
}
```

---

## Usage Examples

### JavaScript/TypeScript

```javascript
// 1. Create execution with initial events
const createResponse = await fetch('/api/executions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'my-template',
    name: 'Production Run #1',
    externalEvents: [
      {
        id: 'evt-1',
        timestamp: Date.now(),
        type: 'system.start',
        source: 'api',
        data: { config: 'production' }
      }
    ]
  })
});

const { executionId } = await createResponse.json();

// 2. Push new events (stream-like)
await fetch(`/api/executions/${executionId}/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: [
      {
        id: 'evt-2',
        timestamp: Date.now(),
        type: 'user.action',
        source: 'api',
        data: { action: 'click', element: 'button-1' }
      }
    ]
  })
});

// 3. Fetch events with pagination
const eventsResponse = await fetch(
  `/api/executions/${executionId}/events?limit=20&offset=0`
);
const { events, pagination } = await eventsResponse.json();

// 4. Filter by event type
const filteredResponse = await fetch(
  `/api/executions/${executionId}/events?type=user.action`
);
```

### cURL

```bash
# Create execution
curl -X POST http://localhost:3000/api/executions \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "my-template",
    "name": "Test Execution",
    "externalEvents": [
      {
        "id": "evt-1",
        "timestamp": 1700000000000,
        "type": "test.event",
        "source": "curl",
        "data": {"test": true}
      }
    ]
  }'

# Push new events
curl -X POST http://localhost:3000/api/executions/exec-abc123/events \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "id": "evt-2",
        "timestamp": 1700000100000,
        "type": "test.event2",
        "source": "curl",
        "data": {"test": true}
      }
    ]
  }'

# Get events
curl http://localhost:3000/api/executions/exec-abc123/events?limit=10
```

---

## Test Script

A comprehensive test script is available at [test-execution-api.mjs](./test-execution-api.mjs).

Run it with:
```bash
node test-execution-api.mjs
```

This will:
1. Create an execution with initial events
2. Push new events to the execution
3. Fetch events with pagination
4. Filter events by type
5. Demonstrate the full API workflow

---

## Use Cases

### Real-time Event Streaming
Perfect for scenarios where events arrive in real-time and need to be appended to an execution:

```javascript
// WebSocket or SSE handler
websocket.on('message', async (event) => {
  await fetch(`/api/executions/${executionId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      events: [{
        id: generateId(),
        timestamp: Date.now(),
        type: event.type,
        source: 'websocket',
        data: event.data
      }]
    })
  });
});
```

### Batch Event Processing
Load events in batches for analysis:

```javascript
let offset = 0;
const limit = 100;

while (true) {
  const response = await fetch(
    `/api/executions/${executionId}/events?limit=${limit}&offset=${offset}`
  );
  const { events, pagination } = await response.json();

  // Process events
  await processEvents(events);

  if (!pagination.hasMore) break;
  offset += limit;
}
```

### Event Type Analytics
Analyze events by type:

```javascript
const response = await fetch(`/api/executions/${executionId}/events`);
const { metadata } = await response.json();

console.log('Event types:', metadata.eventTypes);
console.log('Total events:', metadata.totalEvents);
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

Common HTTP status codes:
- `200` - Success (GET, POST)
- `201` - Created (POST /api/executions)
- `400` - Bad Request (invalid input)
- `404` - Not Found (execution doesn't exist)
- `500` - Internal Server Error

---

## Integration with Existing APIs

These new endpoints complement the existing admin APIs:

- `/api/admin/executions` - Full execution management (legacy)
- `/api/executions` - Stream-like event management (new, simplified)

Both APIs work with the same Firebase data structure, so you can mix and match as needed.

---

## Files Created

- [app/src/app/api/executions/route.ts](./src/app/api/executions/route.ts) - Create/list executions
- [app/src/app/api/executions/[executionId]/route.ts](./src/app/api/executions/[executionId]/route.ts) - Get/delete execution
- [app/src/app/api/executions/[executionId]/events/route.ts](./src/app/api/executions/[executionId]/events/route.ts) - Event streaming
- [app/test-execution-api.mjs](./test-execution-api.mjs) - Test script
