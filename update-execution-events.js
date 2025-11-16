const fetch = require('node-fetch');

async function updateExecution() {
  // Get current execution
  const execResp = await fetch('http://localhost:3000/api/executions/hU2K3b5sn4Q2lhmusOvJP');
  const execData = await execResp.json();
  
  // Update events with targetDataSourceId
  const updatedEvents = execData.execution.externalEvents.map(event => {
    if (event.type === 'document.processed') {
      return { ...event, targetDataSourceId: 'DocumentEvents' };
    } else if (event.type === 'gemini.signature.verified') {
      return { ...event, targetDataSourceId: 'GeminiEvents' };
    }
    return event;
  });
  
  console.log('Updated events:', JSON.stringify(updatedEvents, null, 2));
  
  // Update execution
  const updateResp = await fetch('http://localhost:3000/api/executions/hU2K3b5sn4Q2lhmusOvJP', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalEvents: updatedEvents })
  });
  
  const result = await updateResp.json();
  console.log('✅ Execution updated:', result.success);
}

updateExecution();
