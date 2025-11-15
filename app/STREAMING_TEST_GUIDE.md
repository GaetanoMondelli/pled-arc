# Streaming Events Test Guide

## 🎯 What We Created

A complete execution events streaming system that allows you to:
1. Create executions with initial events
2. Push new events to existing executions (stream-like)
3. View executions and events in real-time via browser

## 🚀 Quick Start

### 1. Run the Streaming Test

```bash
cd app
node test-streaming-events.mjs
```

This will:
- Create a new execution with 3 initial events
- Start pushing 1-3 random events every 2 seconds
- Print URLs to view the execution in your browser
- Every 5 events, verify that events are being appended correctly

### 2. View in Browser

The test script outputs URLs like:

```
🌐 OPEN THESE URLS IN YOUR BROWSER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 View Execution:     http://localhost:3000/api/executions/{executionId}
📋 View Events:        http://localhost:3000/api/executions/{executionId}/events
📈 View Events (Live): http://localhost:3000/api/executions/{executionId}/events?limit=10
```

**Option A: Nice HTML View (Auto-refreshes every 3 seconds)**
```
http://localhost:3000/api/executions/{executionId}/view
```

**Option B: Raw JSON**
```
http://localhost:3000/api/executions/{executionId}
http://localhost:3000/api/executions/{executionId}/events
```

### 3. Stop the Test

Press `Ctrl+C` to stop the streaming test. It will show final statistics.

## 📊 What to Watch

### In Terminal:
```
✅ [2025-11-15T14:34:37.247Z] Pushed 1 events | Total now: 4 | Session pushed: 1
   → error.occurred: {"errorCode":["ERR_257"]...
✅ [2025-11-15T14:34:39.263Z] Pushed 2 events | Total now: 6 | Session pushed: 3
   → order.completed: {"orderId":"order-..."...
   → error.occurred: {"errorCode":["ERR_288"]...
```

Every push shows:
- Timestamp
- Number of events pushed
- Total events in execution
- Session total (how many pushed since start)
- Preview of event data

### In Browser (HTML View):

The HTML viewer shows:
- **Stats**: Total events, event types, template ID, creation time
- **Controls**: Refresh button, auto-refresh toggle (default: 3 seconds)
- **Events List**: All events in reverse chronological order (newest first)
- **Filter**: Filter events by type
- **Auto-refresh**: Page auto-reloads to show new events

### In Browser (JSON APIs):

**Get Full Execution:**
```bash
curl http://localhost:3000/api/executions/{executionId}
```

**Get Events (with pagination):**
```bash
# First 10 events
curl "http://localhost:3000/api/executions/{executionId}/events?limit=10&offset=0"

# Next 10 events
curl "http://localhost:3000/api/executions/{executionId}/events?limit=10&offset=10"

# Filter by type
curl "http://localhost:3000/api/executions/{executionId}/events?type=user.login"

# Get events after timestamp
curl "http://localhost:3000/api/executions/{executionId}/events?since=1700000000000"
```

## 🧪 Verification Points

The test script verifies:

1. ✅ **Initial events are saved** - Creates execution with 3 events
2. ✅ **Events can be fetched** - GET request confirms events exist
3. ✅ **New events append to existing** - POST adds events without replacing
4. ✅ **Event count increases** - Total count goes up after each push
5. ✅ **Events persist** - Fetching again shows accumulated events

Example verification (happens every 5 events):
```
🔍 Verification check - fetching latest events...
✅ Latest 5 events from execution:
   [1] error.occurred - 2:34:33 PM
   [2] user.signup - 2:34:33 PM
   [3] order.completed - 2:34:33 PM
   [4] error.occurred - 2:34:36 PM
   [5] order.completed - 2:34:38 PM
```

## 📝 Event Types Generated

The test generates 6 types of random events:

1. **user.signup** - New user registrations
2. **user.login** - User login events
3. **order.created** - New orders
4. **order.completed** - Completed orders
5. **payment.processed** - Payment transactions
6. **error.occurred** - System errors

Each event has realistic random data like user IDs, amounts, error codes, etc.

## 🔧 API Endpoints

### Create Execution
```bash
POST /api/executions
{
  "templateId": "template-id",
  "name": "My Execution",
  "description": "Optional",
  "externalEvents": [...]  # Optional initial events
}
```

### Get Execution
```bash
GET /api/executions/{executionId}
```

### Get Events (stream-like)
```bash
GET /api/executions/{executionId}/events
Query params: offset, limit, type, since
```

### Push Events (append)
```bash
POST /api/executions/{executionId}/events
{
  "events": [
    {
      "id": "unique-id",
      "timestamp": 1700000000000,
      "type": "event.type",
      "source": "api",
      "data": {...}
    }
  ]
}
```

### View in Browser
```bash
GET /api/executions/{executionId}/view
```

## 📂 Files Created

- [test-streaming-events.mjs](./test-streaming-events.mjs) - Interactive streaming test
- [src/app/api/executions/route.ts](./src/app/api/executions/route.ts) - Create/list executions
- [src/app/api/executions/[executionId]/route.ts](./src/app/api/executions/[executionId]/route.ts) - Get/delete execution
- [src/app/api/executions/[executionId]/events/route.ts](./src/app/api/executions/[executionId]/events/route.ts) - Stream events
- [src/app/api/executions/[executionId]/view/route.ts](./src/app/api/executions/[executionId]/view/route.ts) - HTML viewer

## 🎨 Example Usage

### Create and Stream Events
```javascript
// 1. Create execution
const response = await fetch('/api/executions', {
  method: 'POST',
  body: JSON.stringify({
    templateId: 'my-template',
    name: 'Real-time Test',
    externalEvents: [{ id: '1', timestamp: Date.now(), type: 'start', source: 'api', data: {} }]
  })
});
const { executionId } = await response.json();

// 2. Stream events in
setInterval(async () => {
  await fetch(`/api/executions/${executionId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      events: [{
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'sensor.reading',
        source: 'iot',
        data: { temperature: Math.random() * 100 }
      }]
    })
  });
}, 1000);

// 3. View in browser
console.log(`View at: http://localhost:3000/api/executions/${executionId}/view`);
```

## 🎯 Current Test Running

Execution ID: `fWyHprSdaF8hycXjtKSaZ`

View at:
- http://localhost:3000/api/executions/fWyHprSdaF8hycXjtKSaZ/view
- http://localhost:3000/api/executions/fWyHprSdaF8hycXjtKSaZ
- http://localhost:3000/api/executions/fWyHprSdaF8hycXjtKSaZ/events

## ✅ What's Confirmed

✅ Execution created in Firebase
✅ Initial events saved
✅ New events appending (not replacing)
✅ Event count increasing correctly
✅ Events retrievable via API
✅ Auto-verification every 5 events
✅ Real-time viewing in browser
