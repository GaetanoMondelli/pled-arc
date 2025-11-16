const templateId = 'Y5YD3t73ivOPFo1ESudeN';
const executionId = '93gnbgYpAJUUZ8HjBoSMG';

console.log('🚀 Running execution through Engine API...\n');

fetch(`http://localhost:3000/api/engine/templates/${templateId}/executions/${executionId}/step`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ steps: 10 }),
  signal: AbortSignal.timeout(30000)
})
.then(r => r.json())
.then(result => {
  console.log('✅ Engine API Result:');
  console.log('Events processed:', result.eventsProcessed);
  console.log('Success:', result.success);
  console.log('\nLedger entries:', result.ledger?.length || 0);
  
  if (result.ledger && result.ledger.length > 0) {
    const lastEntry = result.ledger[result.ledger.length - 1];
    console.log('\n📊 Last ledger entry:');
    console.log(JSON.stringify(lastEntry, null, 2));
  }
  
  console.log('\n🔗 View in UI:', `http://localhost:3000/template-editor/${templateId}?execution=${executionId}`);
})
.catch(err => console.error('❌ Error:', err.message));
