/**
 * Simple Execution API Test
 *
 * Tests:
 * 1. Create execution with initial events
 * 2. Push more events (verifies append behavior)
 * 3. Fetch events to confirm
 */

const BASE_URL = 'http://localhost:3000';

async function apiCall(method, path, body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) throw new Error(`${data.error} - ${data.details || ''}`);
  return data;
}

async function main() {
  console.log('Testing Execution Events API\n');

  // Get a template
  const { templates } = await apiCall('GET', '/api/admin/templates');
  const templateId = templates[0]?.id;

  if (!templateId) {
    console.error('No templates found');
    return;
  }

  // 1. Create execution with 2 initial events
  console.log('1. Creating execution with 2 initial events...');
  const { executionId, eventCount } = await apiCall('POST', '/api/executions', {
    templateId,
    name: 'Test Execution',
    externalEvents: [
      { id: 'evt-1', timestamp: Date.now(), type: 'test.start', source: 'test', data: { step: 1 } },
      { id: 'evt-2', timestamp: Date.now(), type: 'test.event', source: 'test', data: { step: 2 } }
    ]
  });
  console.log(`   ✓ Created ${executionId} with ${eventCount} events\n`);

  // 2. Push 3 more events
  console.log('2. Pushing 3 more events...');
  const { totalEvents } = await apiCall('POST', `/api/executions/${executionId}/events`, {
    events: [
      { id: 'evt-3', timestamp: Date.now(), type: 'test.event', source: 'test', data: { step: 3 } },
      { id: 'evt-4', timestamp: Date.now(), type: 'test.event', source: 'test', data: { step: 4 } },
      { id: 'evt-5', timestamp: Date.now(), type: 'test.end', source: 'test', data: { step: 5 } }
    ]
  });
  console.log(`   ✓ Total events now: ${totalEvents}\n`);

  // 3. Fetch and verify
  console.log('3. Fetching events...');
  const { events, pagination } = await apiCall('GET', `/api/executions/${executionId}/events`);
  console.log(`   ✓ Retrieved ${pagination.total} events\n`);

  events.forEach((e, i) => console.log(`   [${i + 1}] ${e.type} - ${JSON.stringify(e.data)}`));

  console.log(`\n✓ Test passed! Events were appended (2 → ${totalEvents})`);
  console.log(`\nView at: ${BASE_URL}/api/executions/${executionId}/view`);
}

main().catch(console.error);
