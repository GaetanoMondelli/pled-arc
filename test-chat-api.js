/**
 * Test the /api/chat endpoint
 */

async function testChatAPI() {
  console.log('Testing /api/chat endpoint...\n');

  const testMessage = "Create a simple workflow with a start node, a process node, and an end node";

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testMessage,
        scenario: null,
        history: []
      })
    });

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('\nError response:', errorText);
      return;
    }

    const result = await response.json();

    console.log('\nResponse received:');
    console.log('Keys:', Object.keys(result));
    console.log('Success:', result.success);
    console.log('Message:', result.message?.substring(0, 200));
    console.log('Scenario nodes:', result.scenario?.nodes?.length || 0);
    console.log('Operations:', result.operations?.length || 0);
    console.log('\nFull response:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testChatAPI();
