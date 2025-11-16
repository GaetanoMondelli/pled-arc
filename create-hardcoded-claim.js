/**
 * Create a claim with hardcoded validation parameters
 *
 * This script creates a claim that:
 * 1. Uses the DAO House P&L Complete Flow template
 * 2. Hardcodes specific validation values
 * 3. Can optionally use data from the latest execution ledger entry
 */

const TEMPLATE_ID = 'oypjt7e3uUPnxB4tjlQlU'; // DAO House P&L Complete Flow

// Hardcoded parameters you want to force
const HARDCODED_PARAMS = {
  reliabilityIndex: 97,
  signature: "matched",
  signee: "Michael Burry",
  netProfit: 0.15
};

async function createClaim(executionId = null) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Step 1: Get the template
  console.log('📋 Fetching template:', TEMPLATE_ID);
  const templateResponse = await fetch(`${baseUrl}/api/admin/templates/${TEMPLATE_ID}`);
  const { template } = await templateResponse.json();

  console.log('✅ Template found:', template.name);

  // Step 2: Get latest execution ledger entry if executionId provided
  let ledgerData = null;
  if (executionId) {
    console.log('\n📊 Fetching execution ledger:', executionId);
    const execResponse = await fetch(`${baseUrl}/api/executions/${executionId}`);
    const { execution } = await execResponse.json();

    if (execution.globalActivityLog && execution.globalActivityLog.length > 0) {
      const ledgerEntries = execution.globalActivityLog;
      const latestEntry = ledgerEntries[ledgerEntries.length - 1];

      console.log('✅ Latest ledger entry found:');
      console.log('   Node:', latestEntry.nodeId);
      console.log('   Action:', latestEntry.action);
      console.log('   Value:', JSON.stringify(latestEntry.value).substring(0, 100));

      ledgerData = latestEntry.value;
    }
  }

  // Step 3: Create claim data structure
  const claimData = {
    // Template reference
    workflowTemplateId: TEMPLATE_ID,
    workflowTemplateName: template.name,

    // Claim metadata
    claimName: `P&L Validation - ${new Date().toISOString().split('T')[0]}`,
    description: `Validates P&L statement with signature verification and profit analysis`,

    // Hardcoded validation parameters
    validationCriteria: {
      reliabilityIndex: HARDCODED_PARAMS.reliabilityIndex,
      signature: HARDCODED_PARAMS.signature,
      signee: HARDCODED_PARAMS.signee,
      netProfit: HARDCODED_PARAMS.netProfit,

      // Additional fields from ledger data if available
      ...(ledgerData && typeof ledgerData === 'object' ? {
        fileName: ledgerData.fileName,
        documentId: ledgerData.documentId,
        companyId: ledgerData.companyId,
        validatedAt: ledgerData.validatedAt,
        state: ledgerData.state
      } : {})
    },

    // Guard conditions (FSM validation logic)
    guardConditions: {
      minReliabilityIndex: 70,
      requireSignatureMatch: true,
      minNetProfit: 0,
      formula: `reliabilityIndex >= 70 && signature === "matched" && netProfit > 0`
    },

    // Expected outcome
    expectedState: HARDCODED_PARAMS.reliabilityIndex >= 70 &&
                   HARDCODED_PARAMS.signature === "matched" &&
                   HARDCODED_PARAMS.netProfit > 0 ? 'Approved' : 'Rejected',

    // Metadata
    createdAt: new Date().toISOString(),
    sourceExecution: executionId || null
  };

  console.log('\n✨ Claim created with hardcoded values:');
  console.log(JSON.stringify(claimData, null, 2));

  // Step 4: Save the claim (you can POST this to your claims API)
  // For now, just return the claim data
  return claimData;
}

// Run the script
const executionId = process.argv[2]; // Optional: pass execution ID as argument

console.log('🔧 Creating claim with hardcoded parameters...\n');
console.log('Hardcoded values:');
console.log('  Reliability Index:', HARDCODED_PARAMS.reliabilityIndex);
console.log('  Signature:', HARDCODED_PARAMS.signature);
console.log('  Signee:', HARDCODED_PARAMS.signee);
console.log('  Net Profit:', HARDCODED_PARAMS.netProfit);
console.log('');

createClaim(executionId).then(claim => {
  console.log('\n✅ Claim ready to be submitted!');
  console.log('Expected outcome:', claim.expectedState);

  // Save to file
  const fs = require('fs');
  const outputPath = './generated-claim.json';
  fs.writeFileSync(outputPath, JSON.stringify(claim, null, 2));
  console.log('\n💾 Claim saved to:', outputPath);
}).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
