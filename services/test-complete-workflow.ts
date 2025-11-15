/**
 * Complete Workflow Test: Docling + Workflow Agent
 *
 * This script tests the complete document processing pipeline:
 * 1. Parse PDF with Docling service
 * 2. Send parsed content to Workflow Agent for DSL suggestions
 *
 * Usage: npx tsx services/test-complete-workflow.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'https://a5fd808de8a8.ngrok-free.app';
const DOCLING_API_KEY = process.env.DOCLING_API_KEY || 'your-secure-api-key-here';
const WORKFLOW_AGENT_URL = process.env.WORKFLOW_AGENT_URL || 'https://workflow-agent-319413928411.us-central1.run.app/chat';

interface DoclingResult {
  text?: string;
  metadata?: any;
  structure?: any;
  [key: string]: any;
}

interface WorkflowAgentRequest {
  message: string;
  scenario: string | null;
  history: Array<{ role: string; content: string }>;
}

async function testCompleteWorkflow() {
  console.log('🚀 Testing Complete Document Processing Workflow\n');
  console.log('=' .repeat(60));

  try {
    // ========================================
    // STEP 1: Parse Document with Docling
    // ========================================
    console.log('\n📄 STEP 1: Parsing document with Docling\n');
    console.log(`Endpoint: ${DOCLING_SERVICE_URL}`);

    const documentPath = path.join(__dirname, 'document.pdf');

    if (!fs.existsSync(documentPath)) {
      console.error('❌ Error: document.pdf not found in services folder');
      process.exit(1);
    }

    console.log(`📁 Reading: ${documentPath}`);
    const documentBuffer = fs.readFileSync(documentPath);
    const base64Document = documentBuffer.toString('base64');
    console.log(`📦 Size: ${(documentBuffer.length / 1024).toFixed(2)} KB`);

    console.log('\n⏳ Sending to Docling...');

    const doclingResponse = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOCLING_API_KEY}`,
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        document: base64Document,
        filename: 'document.pdf',
        format: 'pdf'
      })
    });

    console.log(`📡 Response: ${doclingResponse.status} ${doclingResponse.statusText}`);

    if (!doclingResponse.ok) {
      const errorText = await doclingResponse.text();
      throw new Error(`Docling failed: ${doclingResponse.status} - ${errorText}`);
    }

    const parsedDocument: DoclingResult = await doclingResponse.json();

    console.log('✅ Document parsed successfully!');
    console.log(`   Text extracted: ${parsedDocument.text?.length || 0} characters`);
    console.log(`   Metadata keys: ${Object.keys(parsedDocument.metadata || {}).join(', ')}`);

    // Save Docling output
    const doclingOutputPath = path.join(__dirname, 'complete-workflow-docling.json');
    fs.writeFileSync(doclingOutputPath, JSON.stringify(parsedDocument, null, 2));
    console.log(`💾 Saved: ${doclingOutputPath}`);

    // ========================================
    // STEP 2: Send to Workflow Agent
    // ========================================
    console.log('\n' + '=' .repeat(60));
    console.log('\n🤖 STEP 2: Sending to Workflow Agent for DSL suggestions\n');
    console.log(`Endpoint: ${WORKFLOW_AGENT_URL}`);

    // Prepare message from parsed document
    const documentSummary = {
      title: parsedDocument.metadata?.title || 'Untitled Document',
      text_preview: parsedDocument.text?.substring(0, 500) || '',
      total_length: parsedDocument.text?.length || 0,
      structure: parsedDocument.structure || 'Not available',
      full_text: parsedDocument.text || ''
    };

    const agentMessage = `
I have analyzed a document with the following content:

Title: ${documentSummary.title}
Length: ${documentSummary.total_length} characters

Content Preview:
${documentSummary.text_preview}

Please analyze this document and suggest:
1. A Domain-Specific Language (DSL) structure suitable for this type of document
2. Key entities and relationships that should be represented
3. Workflow automation opportunities

Full document text is included for your analysis.

Full Text:
${documentSummary.full_text.substring(0, 2000)}${documentSummary.full_text.length > 2000 ? '...' : ''}
    `.trim();

    console.log(`📝 Message length: ${agentMessage.length} characters`);
    console.log('\n⏳ Sending to Workflow Agent...');

    const workflowRequest: WorkflowAgentRequest = {
      message: agentMessage,
      scenario: 'document-dsl-analysis',
      history: []
    };

    const agentResponse = await fetch(WORKFLOW_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowRequest)
    });

    console.log(`📡 Response: ${agentResponse.status} ${agentResponse.statusText}`);

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      throw new Error(`Workflow Agent failed: ${agentResponse.status} - ${errorText}`);
    }

    const agentResult = await agentResponse.json();

    console.log('✅ Workflow Agent responded successfully!');

    const reply = agentResult.reply || agentResult.response || agentResult.message || agentResult;

    if (typeof reply === 'string') {
      console.log(`\n📊 DSL Suggestions (${reply.length} characters):\n`);
      console.log('-'.repeat(60));
      console.log(reply.substring(0, 1000));
      if (reply.length > 1000) {
        console.log('\n... (truncated, see full output in file)');
      }
      console.log('-'.repeat(60));
    } else {
      console.log('\n📊 DSL Suggestions:\n');
      console.log(JSON.stringify(reply, null, 2).substring(0, 1000));
    }

    // Save Workflow Agent output
    const agentOutputPath = path.join(__dirname, 'complete-workflow-agent.json');
    fs.writeFileSync(agentOutputPath, JSON.stringify(agentResult, null, 2));
    console.log(`\n💾 Saved: ${agentOutputPath}`);

    // ========================================
    // STEP 3: Save Complete Workflow Results
    // ========================================
    const completeResults = {
      timestamp: new Date().toISOString(),
      step1_docling: {
        status: 'success',
        document_length: parsedDocument.text?.length || 0,
        metadata: parsedDocument.metadata,
        output_file: doclingOutputPath
      },
      step2_workflow_agent: {
        status: 'success',
        scenario: 'document-dsl-analysis',
        response_length: typeof reply === 'string' ? reply.length : JSON.stringify(reply).length,
        output_file: agentOutputPath
      },
      pipeline_status: 'completed'
    };

    const summaryPath = path.join(__dirname, 'complete-workflow-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(completeResults, null, 2));

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ COMPLETE WORKFLOW TEST SUCCESSFUL!\n');
    console.log('Summary:');
    console.log(`  ✓ Document parsed: ${completeResults.step1_docling.document_length} chars`);
    console.log(`  ✓ DSL suggestions: ${completeResults.step2_workflow_agent.response_length} chars`);
    console.log(`  ✓ Summary saved: ${summaryPath}`);
    console.log('\n' + '=' .repeat(60));

    return completeResults;

  } catch (error) {
    console.error('\n❌ WORKFLOW TEST FAILED\n');
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testCompleteWorkflow()
    .then(() => {
      console.log('\n✨ All workflow tests passed!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Workflow test suite failed:', error);
      process.exit(1);
    });
}

export { testCompleteWorkflow };
