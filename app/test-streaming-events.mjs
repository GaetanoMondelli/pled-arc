/**
 * Interactive Event Streaming Test
 *
 * Creates an execution and continuously pushes events to it.
 * You can view the execution at: http://localhost:3000/api/executions/{executionId}
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

// Generate random event data
function generateEvent(type, index) {
  const eventTypes = {
    'user.signup': () => ({
      userId: `user-${Math.floor(Math.random() * 1000)}`,
      email: `user${index}@example.com`,
      plan: ['free', 'pro', 'enterprise'][Math.floor(Math.random() * 3)]
    }),
    'user.login': () => ({
      userId: `user-${Math.floor(Math.random() * 1000)}`,
      sessionId: `session-${Date.now()}`,
      ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    }),
    'order.created': () => ({
      orderId: `order-${Date.now()}-${index}`,
      userId: `user-${Math.floor(Math.random() * 1000)}`,
      amount: (Math.random() * 500).toFixed(2),
      items: Math.floor(Math.random() * 10) + 1
    }),
    'order.completed': () => ({
      orderId: `order-${Date.now() - 1000}-${index}`,
      status: 'completed',
      processingTime: Math.floor(Math.random() * 5000) + 1000
    }),
    'payment.processed': () => ({
      paymentId: `pay-${Date.now()}`,
      amount: (Math.random() * 500).toFixed(2),
      method: ['card', 'paypal', 'crypto'][Math.floor(Math.random() * 3)],
      status: 'success'
    }),
    'error.occurred': () => ({
      errorCode: ['ERR_' + Math.floor(Math.random() * 1000)],
      message: 'Something went wrong',
      severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    })
  };

  return eventTypes[type]();
}

async function main() {
  console.log('🚀 Interactive Event Streaming Test');
  console.log('━'.repeat(80));

  try {
    // Step 1: Get a template
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
    console.log('\n📋 Step 2: Creating execution with 3 initial events...');

    const eventTypes = ['user.signup', 'user.login', 'order.created', 'order.completed', 'payment.processed', 'error.occurred'];

    const initialEvents = [1, 2, 3].map((i) => {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      return {
        id: `event-${Date.now()}-${i}`,
        timestamp: Date.now() + (i * 100),
        type,
        source: 'streaming-test',
        data: generateEvent(type, i)
      };
    });

    const createResponse = await apiCall('POST', '/api/executions', {
      templateId,
      name: 'Streaming Test - ' + new Date().toISOString(),
      description: 'Real-time event streaming test - watching events being appended',
      externalEvents: initialEvents
    });

    const executionId = createResponse.executionId;
    console.log(`✅ Execution created: ${executionId}`);
    console.log(`   Initial events: ${createResponse.eventCount}`);

    // Print URLs for manual checking
    console.log('\n━'.repeat(80));
    console.log('🌐 OPEN THESE URLS IN YOUR BROWSER:');
    console.log('━'.repeat(80));
    console.log(`📊 View Execution:     ${BASE_URL}/api/executions/${executionId}`);
    console.log(`📋 View Events:        ${BASE_URL}/api/executions/${executionId}/events`);
    console.log(`📈 View Events (Live): ${BASE_URL}/api/executions/${executionId}/events?limit=10`);
    console.log('━'.repeat(80));

    // Step 3: Verify initial events
    console.log('\n📋 Step 3: Verifying initial events...');
    const eventsCheck = await apiCall('GET', `/api/executions/${executionId}/events`);
    console.log(`✅ Confirmed ${eventsCheck.events.length} events in execution`);

    eventsCheck.events.forEach((event, idx) => {
      console.log(`   [${idx + 1}] ${event.type} at ${new Date(event.timestamp).toISOString()}`);
    });

    // Step 4: Continuously push new events
    console.log('\n📋 Step 4: Starting continuous event stream...');
    console.log('   (Press Ctrl+C to stop)');
    console.log('');

    let eventCounter = 4;
    let totalPushed = 0;

    const streamInterval = setInterval(async () => {
      try {
        // Generate 1-3 random events
        const batchSize = Math.floor(Math.random() * 3) + 1;
        const newEvents = [];

        for (let i = 0; i < batchSize; i++) {
          const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
          newEvents.push({
            id: `event-${Date.now()}-${eventCounter}`,
            timestamp: Date.now(),
            type,
            source: 'streaming-test',
            data: generateEvent(type, eventCounter)
          });
          eventCounter++;
        }

        // Push events
        const pushResponse = await apiCall('POST', `/api/executions/${executionId}/events`, {
          events: newEvents
        });

        totalPushed += batchSize;

        console.log(`✅ [${new Date().toISOString()}] Pushed ${batchSize} events | Total now: ${pushResponse.totalEvents} | Session pushed: ${totalPushed}`);

        // Show what we just pushed
        newEvents.forEach(e => {
          console.log(`   → ${e.type}: ${JSON.stringify(e.data).substring(0, 60)}...`);
        });

        // Verify by fetching latest events
        if (totalPushed % 5 === 0) {
          console.log('\n🔍 Verification check - fetching latest events...');
          const verifyResponse = await apiCall('GET', `/api/executions/${executionId}/events?limit=5`);
          console.log(`✅ Latest ${verifyResponse.events.length} events from execution:`);
          verifyResponse.events.forEach((e, idx) => {
            console.log(`   [${idx + 1}] ${e.type} - ${new Date(e.timestamp).toLocaleTimeString()}`);
          });
          console.log('');
        }

      } catch (error) {
        console.error('❌ Error pushing events:', error.message);
      }
    }, 2000); // Push events every 2 seconds

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping event stream...');
      clearInterval(streamInterval);

      // Final check
      console.log('\n📋 Final verification...');
      const finalResponse = await apiCall('GET', `/api/executions/${executionId}/events`);
      console.log(`✅ Final event count: ${finalResponse.pagination.total}`);
      console.log(`   Event types: ${finalResponse.metadata.eventTypes.join(', ')}`);

      console.log('\n━'.repeat(80));
      console.log('✅ Test completed!');
      console.log(`\n📊 View full execution at: ${BASE_URL}/api/executions/${executionId}`);
      console.log('━'.repeat(80));
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
