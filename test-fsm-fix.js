/**
 * Test FSM Processor Fix
 *
 * This script manually loads and runs the execution to test if the FSM
 * now properly outputs the complete token data object instead of just
 * originalToken: 0
 */

const EXECUTION_ID = 'HOU7iu28BfwqjajlnKKtj';

async function testFSMFix() {
  console.log('🧪 Testing FSM Processor Fix...\n');

  try {
    // Get the execution
    const response = await fetch(`http://localhost:3000/api/executions/${EXECUTION_ID}`);
    const { execution } = await response.json();

    console.log('📋 Execution Details:');
    console.log('  ID:', execution.id);
    console.log('  Template:', execution.templateId);
    console.log('  Name:', execution.name);
    console.log('  External Events:', execution.externalEvents?.length || 0);
    console.log('  Current Time:', execution.currentTime || 0);
    console.log('  Is Completed:', execution.isCompleted || false);

    // Check if simulation has run
    if (execution.currentTime === 0) {
      console.log('\n⚠️  Simulation has not been run yet.');
      console.log('Please open the template editor URL and run the simulation:');
      console.log(`http://localhost:3000/template-editor/9qbCk1Y9drepfl7XZKxxl?execution=${EXECUTION_ID}`);
      return;
    }

    console.log('\n=== VALIDATION FSM OUTPUT ===');
    const fsmActivities = execution.nodeActivityLogs?.ValidationFSM || [];
    const tokenConsumed = fsmActivities.find(a => a.action === 'token_consumed');

    if (tokenConsumed) {
      console.log('✅ Found token_consumed activity');
      console.log('Value:', JSON.stringify(tokenConsumed.value, null, 2));

      // Check if originalToken is an object with all fields
      if (typeof tokenConsumed.value.originalToken === 'object') {
        console.log('\n✅ SUCCESS! originalToken is an object with fields:');
        console.log(Object.keys(tokenConsumed.value.originalToken));

        // Check for required fields
        const requiredFields = ['fileName', 'documentId', 'reliabilityScore', 'netProfit'];
        const hasAllFields = requiredFields.every(field =>
          tokenConsumed.value.originalToken.hasOwnProperty(field)
        );

        if (hasAllFields) {
          console.log('\n✅ All required fields present!');
        } else {
          console.log('\n⚠️  Some required fields missing');
        }
      } else {
        console.log('\n❌ FAILED! originalToken is still a primitive:', tokenConsumed.value.originalToken);
      }
    } else {
      console.log('❌ No token_consumed activity found');
    }

    console.log('\n=== FORMAT RESULT OUTPUT ===');
    const formatActivities = execution.nodeActivityLogs?.FormatResult || [];
    const formatTokenReceived = formatActivities.find(a => a.action === 'token_received');

    if (formatTokenReceived) {
      console.log('✅ Found token_received activity');
      console.log('Value:', JSON.stringify(formatTokenReceived.value, null, 2));
    } else {
      console.log('❌ No token_received activity found');
    }

    console.log('\n=== APPROVED SINK OUTPUT ===');
    const approvedActivities = execution.nodeActivityLogs?.ApprovedSink || [];
    const approvedToken = approvedActivities.find(a => a.action === 'token_received');

    if (approvedToken) {
      console.log('✅ Found approved token');
      console.log('Value:', JSON.stringify(approvedToken.value, null, 2));

      // Check for final required fields
      if (approvedToken.value.reliabilityIndex !== undefined &&
          approvedToken.value.profit !== undefined) {
        console.log('\n✅ Final output has reliabilityIndex and profit!');
      } else {
        console.log('\n⚠️  Final output missing reliabilityIndex or profit');
      }
    } else {
      console.log('❌ No approved token found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFSMFix();
