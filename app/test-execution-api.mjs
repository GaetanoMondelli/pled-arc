/**
 * Test Script for Execution Events API
 *
 * Demonstrates:
 * 1. Creating an execution with initial events
 * 2. Pushing new events to the execution (stream-like)
 * 3. Fetching events with pagination and filtering
 */

const BASE_URL = 'http://localhost:3000';

// Helper function for API calls
async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error: ${data.error} - ${data.details || ''}`);
  }

  return data;
}

async function main() {
  console.log('🧪 Testing Execution Events API');
  console.log('━'.repeat(80));

  try {
    // Step 1: List templates to get a valid templateId
    console.log('\n📋 Step 1: Fetching templates...');
    const templatesResponse = await apiCall('GET', '/api/admin/templates');
    const templates = templatesResponse.templates || [];

    if (templates.length === 0) {
      console.error('❌ No templates found. Please create a template first.');
      return;
    }

    const templateId = templates[0].id;
    console.log(`✅ Using template: ${templates[0].name} (${templateId})`);

    // Step 2: Create execution with initial events
    console.log('\n📋 Step 2: Creating execution with initial events...');

    const initialEvents = [
      {
        id: `event-${Date.now()}-1`,
        timestamp: Date.now(),
        type: 'user.signup',
        source: 'api-test',
        data: { userId: 'user-123', email: 'test@example.com' }
      },
      {
        id: `event-${Date.now()}-2`,
        timestamp: Date.now() + 1000,
        type: 'user.login',
        source: 'api-test',
        data: { userId: 'user-123', sessionId: 'session-456' }
      }
    ];

    const createResponse = await apiCall('POST', '/api/executions', {
      templateId,
      name: 'API Test Execution - ' + new Date().toISOString(),
      description: 'Testing the new execution events API',
      externalEvents: initialEvents
    });

    console.log(`✅ Execution created: ${createResponse.executionId}`);
    console.log(`   Events: ${createResponse.eventCount}`);

    const executionId = createResponse.executionId;

    // Step 3: Fetch events (should show initial 2 events)
    console.log('\n📋 Step 3: Fetching events from execution...');

    const eventsResponse1 = await apiCall('GET', `/api/executions/${executionId}/events`);
    console.log(`✅ Retrieved ${eventsResponse1.events.length} events`);
    console.log(`   Total: ${eventsResponse1.pagination.total}`);
    console.log(`   Event types: ${eventsResponse1.metadata.eventTypes.join(', ')}`);

    eventsResponse1.events.forEach((event, idx) => {
      console.log(`   [${idx + 1}] ${event.type} - ${new Date(event.timestamp).toISOString()}`);
    });

    // Step 4: Push new events (stream-like append)
    console.log('\n📋 Step 4: Pushing new events to execution...');

    const newEvents = [
      {
        id: `event-${Date.now()}-3`,
        timestamp: Date.now() + 2000,
        type: 'order.created',
        source: 'api-test',
        data: { orderId: 'order-789', userId: 'user-123', amount: 99.99 }
      },
      {
        id: `event-${Date.now()}-4`,
        timestamp: Date.now() + 3000,
        type: 'order.completed',
        source: 'api-test',
        data: { orderId: 'order-789', status: 'completed' }
      },
      {
        id: `event-${Date.now()}-5`,
        timestamp: Date.now() + 4000,
        type: 'user.logout',
        source: 'api-test',
        data: { userId: 'user-123', sessionId: 'session-456' }
      }
    ];

    const pushResponse = await apiCall('POST', `/api/executions/${executionId}/events`, {
      events: newEvents
    });

    console.log(`✅ Pushed ${pushResponse.eventsAdded} new events`);
    console.log(`   Total events now: ${pushResponse.totalEvents}`);

    // Step 5: Fetch all events again
    console.log('\n📋 Step 5: Fetching all events after push...');

    const eventsResponse2 = await apiCall('GET', `/api/executions/${executionId}/events`);
    console.log(`✅ Retrieved ${eventsResponse2.events.length} events`);
    console.log(`   Total: ${eventsResponse2.pagination.total}`);
    console.log(`   Event types: ${eventsResponse2.metadata.eventTypes.join(', ')}`);

    eventsResponse2.events.forEach((event, idx) => {
      console.log(`   [${idx + 1}] ${event.type} - ${new Date(event.timestamp).toISOString()}`);
    });

    // Step 6: Test pagination
    console.log('\n📋 Step 6: Testing pagination (limit: 2, offset: 0)...');

    const paginatedResponse = await apiCall('GET', `/api/executions/${executionId}/events?limit=2&offset=0`);
    console.log(`✅ Retrieved ${paginatedResponse.events.length} events (of ${paginatedResponse.pagination.total})`);
    console.log(`   Has more: ${paginatedResponse.pagination.hasMore}`);

    paginatedResponse.events.forEach((event, idx) => {
      console.log(`   [${idx + 1}] ${event.type}`);
    });

    // Step 7: Test filtering by type
    console.log('\n📋 Step 7: Testing filter by type (type=user.login)...');

    const filteredResponse = await apiCall('GET', `/api/executions/${executionId}/events?type=user.login`);
    console.log(`✅ Retrieved ${filteredResponse.events.length} events with type 'user.login'`);

    filteredResponse.events.forEach((event, idx) => {
      console.log(`   [${idx + 1}] ${event.type} - ${JSON.stringify(event.data)}`);
    });

    // Step 8: Get execution details
    console.log('\n📋 Step 8: Getting execution details...');

    const executionResponse = await apiCall('GET', `/api/executions/${executionId}`);
    console.log(`✅ Execution: ${executionResponse.execution.name}`);
    console.log(`   Template: ${executionResponse.execution.templateId}`);
    console.log(`   Total events: ${executionResponse.eventCount}`);
    console.log(`   Created: ${new Date(executionResponse.execution.createdAt).toISOString()}`);

    console.log('\n━'.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log(`\nExecution ID: ${executionId}`);
    console.log(`View at: ${BASE_URL}/executions/${executionId}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
