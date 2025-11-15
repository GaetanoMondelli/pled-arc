# Chat Workflow Agent

A LangGraph-based AI agent that converts natural language chat messages into structured workflow scenarios. The agent uses a sophisticated state machine with intelligent retry logic to ensure accurate workflow generation.

## 🚀 Deployment

**Live URL:** https://workflow-agent-319413928411.us-central1.run.app

## 📊 Workflow Architecture

![Workflow Graph](graph.png)

### Workflow Steps Explained

The agent processes requests through 7 distinct steps with an intelligent reflection loop:

#### 1. **Start** → **Context Analysis**
- Analyzes the current scenario (if exists)
- Extracts existing nodes and their relationships
- Builds context from chat history (last 5 messages)
- Prepares the environment for DSL parsing

#### 2. **Context Analysis** → **DSL Parsing**
- Uses Gemini 2.0 AI to parse natural language
- Identifies DSL patterns:
  - `@NodeName` - References to existing nodes
  - `like @NodeName` - Create similar nodes
  - `connected to` - Edge creation requests
  - `if X goes to Y` - Conditional routing
- Outputs structured JSON with nodes and connections

#### 3. **DSL Parsing** → **Positioning**
- **Note:** This happens BEFORE building actual nodes (on specs only)
- Currently finds MAX x and MAX y of existing nodes
- Places new nodes 300px to the right of existing ones
- Groups new nodes by connection depth for layout
- Maintains 250px horizontal, 180px vertical spacing
- **TODO:** Should calculate full bounding box (min/max) and position intelligently

#### 4. **Positioning** → **Scenario Building**
- Converts parsed request into actual workflow nodes
- Supports node types:
  - **DataSource** - Entry point for data flow
  - **ProcessNode** - Transforms data (formulas, AI prompts, validation)
  - **Multiplexer** - Routes data conditionally
  - **FSM (Finite State Machine)** - State-based workflow logic
  - **Queue** - Buffers and batches data
  - **Sink** - Collects/displays results
  - **MarkdownComment** - Documentation annotations
- Creates edges between nodes
- Generates IDs as: `${NodeType}_${Timestamp}_${RandomHash}`
- **TODO:** Could simplify to just hash or shorter format

#### 5. **Scenario Building** → **Validation**
- Schema validation using AJV
- Checks for:
  - Valid node structure
  - Required fields present
  - No duplicate edge IDs
  - At least one node exists
- Returns validation issues if found

#### 6. **Validation** → **Reflection** (Decision Point)
The **Reflection** node is the intelligence center that decides next steps:

- **If validation passed** → `Finish` → Response Generation
- **If validation failed:**
  - **Retry** (up to 3 times) → Back to DSL Parsing with error context
  - **Fix** → Back to Scenario Building to repair issues
  - **Error** (after 3 retries) → Response Generation with error

This reflection loop ensures the agent learns from validation errors and improves its output.

#### 7. **Response Generation** → **End**
- Packages the final scenario
- Includes debug information:
  - Retry count
  - State journey
  - Validation results
  - Execution metadata
- Returns JSON response to client

## 🔄 The Retry Loop

The most powerful feature is the **intelligent retry loop**:

```
DSL Parsing → Positioning → Scenario Building → Validation
     ↑                                              ↓
     ←────────── Reflection (retry_parsing) ←──────┘
```

When validation fails, the Reflection node:
1. Analyzes the validation errors
2. Adds error context to the prompt
3. Retries parsing with improved understanding
4. Can attempt up to 3 times before giving up

## 📁 Project Structure

```
workflow-agent/
├── src/
│   └── chat-workflow-agent.ts    # Main agent (ONE file!)
├── dist/                          # Compiled JavaScript
├── test-chat-agent.ts             # Test suite
├── Dockerfile                     # Cloud Run container
├── deploy.sh                      # Deployment script
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── graph.png                      # Workflow visualization
└── studio-web-viewer.html         # Web UI for testing
```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Set API key
export GOOGLE_AI_API_KEY=AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY

# Run locally
npm run dev

# Test
npm test
```

## 🔌 API Endpoints

### Main Chat Endpoint
```bash
POST /chat
Content-Type: application/json

{
  "message": "Create a data source connected to a processing node",
  "scenario": null,  // Optional: existing scenario
  "history": []      // Optional: chat history
}
```

### LangGraph Studio Endpoints
- `GET /graph` - Workflow structure
- `POST /run` - Execute workflow (Studio format)
- `GET /threads` - List execution threads
- `GET /api/stream` - SSE real-time updates

## 💡 Example Requests

```javascript
// Simple node creation
"Create a data source"

// Connected nodes
"Create a data source connected to a processing node"

// Complex workflow
"Create a data source that generates sensor data every 2 seconds,
 process it with an AI node that validates the values,
 then route valid data to a database sink"

// Reference existing nodes
"Connect @DataSource_1 to a new processing node"

// Conditional routing
"Create a multiplexer that routes high values to @AlertSink"
```

## 🔧 Configuration

**Environment Variables:**
- `GOOGLE_AI_API_KEY` - Required for Gemini AI
- `PORT` - Server port (default: 3002, Cloud Run sets automatically)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging verbosity

## 🚢 Deployment

```bash
# Deploy to Cloud Run
./deploy.sh

# Update existing deployment
gcloud run services update workflow-agent \
  --region us-central1 \
  --set-env-vars "GOOGLE_AI_API_KEY=AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY"
```

## 🧪 Testing

Open `studio-web-viewer.html` in a browser to:
- View the workflow graph
- Execute test requests
- See execution threads
- Monitor real-time updates

Or test with curl:
```bash
# Test health
curl https://workflow-agent-319413928411.us-central1.run.app/health

# Test chat
curl -X POST https://workflow-agent-319413928411.us-central1.run.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a simple data source", "scenario": null, "history": []}'
```

## 📈 Performance

- **Cold start:** ~3-5 seconds
- **Warm response:** ~1-2 seconds
- **Retry on error:** Adds ~1 second per retry
- **Max retries:** 3 attempts
- **Auto-scaling:** 0-10 instances
- **Cost when idle:** $0 (scales to zero)

## 🎯 Key Features

1. **Intelligent Retry Logic** - Learns from validation errors
2. **Chat History Context** - Maintains conversation state
3. **Smart Positioning** - Automatic layout algorithm
4. **Schema Validation** - Ensures valid workflows
5. **Real-time Updates** - SSE streaming of progress
6. **LangGraph Studio Compatible** - Full Studio support
7. **Single File Architecture** - All logic in one maintainable file

## 🔧 Potential Improvements

Based on your feedback, these could be improved:

1. **Better Positioning Algorithm**
   - Calculate full bounding box (minX, maxX, minY, maxY)
   - Place new nodes intelligently around existing ones
   - Consider moving positioning AFTER scenario building

2. **Simpler ID Generation**
   - Current: `DataSource_1234567890_abc12`
   - Could be: Just a short hash or UUID

3. **Node Descriptions**
   - Remove interval/timing references (ES simulation handles this)
   - Focus on what nodes DO, not HOW they execute

4. **FSM Support**
   - Add better FSM node creation in DSL parsing
   - Support state definitions and transitions

## 📝 License

MIT