/**
 * Test Docling Service Integration
 *
 * This script tests the Docling document parsing service.
 * Docling converts PDF and other documents into structured JSON format.
 *
 * Usage: npx tsx services/test-docling.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'https://a5fd808de8a8.ngrok-free.app';
const DOCLING_API_KEY = process.env.DOCLING_API_KEY || 'your-secure-api-key-here';

async function testDoclingService() {
  console.log('🔍 Testing Docling Service...\n');
  console.log(`Endpoint: ${DOCLING_SERVICE_URL}`);

  try {
    // Read the sample PDF document
    const documentPath = path.join(__dirname, 'document.pdf');

    if (!fs.existsSync(documentPath)) {
      console.error('❌ Error: document.pdf not found in services folder');
      process.exit(1);
    }

    console.log(`📄 Found document: ${documentPath}`);
    const documentBuffer = fs.readFileSync(documentPath);
    const base64Document = documentBuffer.toString('base64');

    console.log(`📦 Document size: ${(documentBuffer.length / 1024).toFixed(2)} KB\n`);

    // Test 1: Health Check
    console.log('1️⃣  Testing health endpoint...');
    try {
      const healthResponse = await fetch(`${DOCLING_SERVICE_URL}/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (healthResponse.ok) {
        console.log('✅ Health check passed');
        const healthData = await healthResponse.json();
        console.log('   Status:', healthData);
      } else {
        console.log('⚠️  Health check returned:', healthResponse.status);
      }
    } catch (error) {
      console.log('⚠️  Health endpoint not available:', (error as Error).message);
    }

    console.log('');

    // Test 2: Parse Document
    console.log('2️⃣  Parsing document with Docling...');

    const parseResponse = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
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

    console.log('   Response status:', parseResponse.status, parseResponse.statusText);

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.log('❌ Error response:', errorText);
      throw new Error(`Docling service returned ${parseResponse.status}: ${errorText}`);
    }

    const result: any = await parseResponse.json();

    console.log('✅ Document parsed successfully!\n');
    console.log('📊 Parsed Result Summary:');
    console.log('   Response type:', typeof result);
    console.log('   Keys:', Object.keys(result));

    // Handle different response structures
    const textContent = result.text || result.content || result.parsed_text || '';
    const metadata = result.metadata || result.meta || {};

    if (textContent) {
      console.log(`   Text length: ${textContent.length} characters`);
      console.log(`   Preview: ${textContent.substring(0, 200)}...`);
    } else {
      console.log('   ⚠️  No text field found, full result:', JSON.stringify(result).substring(0, 300));
    }

    if (Object.keys(metadata).length > 0) {
      console.log('   Metadata:', metadata);
    }

    // Save the result
    const outputPath = path.join(__dirname, 'docling-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full result saved to: ${outputPath}`);

    // Save a summary too
    const summaryPath = path.join(__dirname, 'test-docling-summary.txt');
    const summary = `
DOCLING SERVICE TEST RESULTS
============================
Timestamp: ${new Date().toISOString()}
Endpoint: ${DOCLING_SERVICE_URL}
Status: SUCCESS

Document Info:
- File: document.pdf
- Size: ${(documentBuffer.length / 1024).toFixed(2)} KB

Response Info:
- Status: ${parseResponse.status}
- Response keys: ${Object.keys(result).join(', ')}
- Text length: ${textContent.length} characters

Files Created:
- Full JSON: ${outputPath}
- Summary: ${summaryPath}

Preview of parsed text:
${textContent.substring(0, 500)}...
`;
    fs.writeFileSync(summaryPath, summary);
    console.log(`💾 Summary saved to: ${summaryPath}`);

    console.log('\n✅ Docling service test completed successfully!');
    return result;

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }

    // Save error details to file
    const errorPath = path.join(__dirname, 'test-docling-error.txt');
    const errorDetails = `
DOCLING SERVICE TEST ERROR
==========================
Timestamp: ${new Date().toISOString()}
Endpoint: ${DOCLING_SERVICE_URL}
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
  testDoclingService()
    .then(() => {
      console.log('\n✨ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { testDoclingService };
