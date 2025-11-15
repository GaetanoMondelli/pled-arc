/**
 * Test Workflow Agent Integration
 *
 * This script tests the Workflow Agent service.
 * The agent provides suggestions for creating DSL based on document analysis.
 *
 * Usage: npx tsx services/test-workflow-agent.ts
 */

const WORKFLOW_AGENT_URL = process.env.WORKFLOW_AGENT_URL || 'https://workflow-agent-319413928411.us-central1.run.app/chat';

async function testWorkflowAgent() {
  console.log('🤖 Testing Workflow Agent...\n');
  console.log(`Endpoint: ${WORKFLOW_AGENT_URL}`);

  try {
    // Test 1: Simple message test
    console.log('\n1️⃣  Testing with simple message...');

    const testMessage = "Hello! Can you help me analyze a contract document?";

    const response1 = await fetch(WORKFLOW_AGENT_URL, {
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

    console.log('   Response status:', response1.status, response1.statusText);

    if (!response1.ok) {
      const errorText = await response1.text();
      console.log('❌ Error response:', errorText);
      throw new Error(`Workflow Agent returned ${response1.status}: ${errorText}`);
    }

    const result1 = await response1.json();

    console.log('✅ Agent responded successfully!\n');
    console.log('📝 Response:');
    console.log('   Keys:', Object.keys(result1));
    console.log('   Reply:', result1.reply || result1.response || result1.message || result1);

    // Test 2: Document analysis scenario
    console.log('\n2️⃣  Testing with document analysis scenario...');

    const documentAnalysisMessage = `
      Analyze this contract structure:
      {
        "title": "Service Agreement",
        "parties": ["Company A", "Company B"],
        "terms": ["Payment within 30 days", "Delivery by end of month"],
        "duration": "12 months"
      }

      Please suggest a DSL structure for this type of contract.
    `;

    const response2 = await fetch(WORKFLOW_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: documentAnalysisMessage,
        scenario: 'contract-analysis',
        history: [
          {
            role: 'user',
            content: testMessage
          },
          {
            role: 'assistant',
            content: result1.reply || result1.response || 'Hello! I can help you analyze contract documents.'
          }
        ]
      })
    });

    console.log('   Response status:', response2.status, response2.statusText);

    if (!response2.ok) {
      const errorText = await response2.text();
      console.log('❌ Error response:', errorText);
      throw new Error(`Workflow Agent returned ${response2.status}: ${errorText}`);
    }

    const result2 = await response2.json();

    console.log('✅ Agent provided DSL suggestions!\n');
    console.log('📊 DSL Suggestions:');
    console.log('   Keys:', Object.keys(result2));

    const agentReply = result2.reply || result2.response || result2.message || result2;
    if (typeof agentReply === 'string') {
      console.log(`   Length: ${agentReply.length} characters`);
      console.log(`   Preview: ${agentReply.substring(0, 300)}...`);
    } else {
      console.log('   Full response:', JSON.stringify(agentReply, null, 2));
    }

    // Save results
    const fs = await import('fs');
    const path = await import('path');

    const fullResults = {
      test1: result1,
      test2: result2
    };

    const outputPath = path.join(__dirname, 'workflow-agent-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(fullResults, null, 2));
    console.log(`\n💾 Full results saved to: ${outputPath}`);

    // Save summary
    const summaryPath = path.join(__dirname, 'test-workflow-agent-summary.txt');
    const reply1 = result1.reply || result1.response || result1.message || result1;
    const reply2 = result2.reply || result2.response || result2.message || result2;

    const summary = `
WORKFLOW AGENT TEST RESULTS
============================
Timestamp: ${new Date().toISOString()}
Endpoint: ${WORKFLOW_AGENT_URL}
Status: SUCCESS

Test 1: Simple Message
- Input: "Hello! Can you help me analyze a contract document?"
- Response length: ${typeof reply1 === 'string' ? reply1.length : JSON.stringify(reply1).length} characters
- Response preview: ${typeof reply1 === 'string' ? reply1.substring(0, 200) : JSON.stringify(reply1).substring(0, 200)}...

Test 2: Document Analysis
- Scenario: contract-analysis
- Response length: ${typeof reply2 === 'string' ? reply2.length : JSON.stringify(reply2).length} characters
- Response preview: ${typeof reply2 === 'string' ? reply2.substring(0, 200) : JSON.stringify(reply2).substring(0, 200)}...

Files Created:
- Full JSON: ${outputPath}
- Summary: ${summaryPath}
`;
    fs.writeFileSync(summaryPath, summary);
    console.log(`💾 Summary saved to: ${summaryPath}`);

    console.log('\n✅ Workflow Agent test completed successfully!');
    return { result1, result2 };

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }

    // Save error details
    const fs = await import('fs');
    const path = await import('path');
    const errorPath = path.join(__dirname, 'test-workflow-agent-error.txt');
    const errorDetails = `
WORKFLOW AGENT TEST ERROR
=========================
Timestamp: ${new Date().toISOString()}
Endpoint: ${WORKFLOW_AGENT_URL}
Status: FAILED

Error Details:
${error instanceof Error ? error.message : String(error)}

Stack Trace:
${error instanceof Error ? error.stack : 'N/A'}
`;
    fs.writeFileSync(errorPath, errorDetails);
    console.error(`\n💾 Error details saved to: ${errorPath}`);

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testWorkflowAgent()
    .then(() => {
      console.log('\n✨ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { testWorkflowAgent };
