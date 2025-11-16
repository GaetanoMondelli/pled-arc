const TEMPLATE_ID = '0DRst7Ohx8SdilIAdEEeF';

const externalEvents = [
  {
    id: "evt_upload_1763243258940",
    type: "document.uploaded",
    source: "EXTERNAL",
    targetDataSourceId: "DocumentUploadSource",
    timestamp: 1000,
    data: {
      documentId: "doc-1763243258940",
      companyId: "company-123",
      fileName: "PL_2024_Q4.pdf",
      documentType: "profit-loss",
      uploadedAt: "2024-01-15T10:00:00Z"
    }
  },
  {
    id: "evt_processed_1763243261663",
    type: "document.processed",
    source: "EXTERNAL",
    targetDataSourceId: "DocumentProcessedSource",
    timestamp: 2000,
    data: {
      documentId: "doc-1763243258940",
      companyId: "company-123",
      fileName: "PL_2024_Q4.pdf",
      textContent: "Profit and Loss Statement Q4 2024. Total Revenue: $500,000. Total Expenses: $400,000. Net Profit: $100,000",
      markdownContent: "# Profit and Loss Statement Q4 2024\n\n**Total Revenue:** $500,000\n**Total Expenses:** $400,000\n**Net Profit:** $100,000",
      jsonContent: {
        netProfit: 100000,
        revenue: 500000,
        expenses: 400000,
        period: "Q4 2024"
      },
      processedAt: "2024-01-15T10:01:00Z"
    }
  },
  {
    id: "evt_gemini_1763243262000",
    type: "gemini.signature.verified",
    source: "EXTERNAL",
    targetDataSourceId: "GeminiVerificationSource",
    timestamp: 3000,
    data: {
      documentId: "doc-1763243258940",
      isValid: true,
      reliabilityScore: 87,
      signedBy: "Michael Burry",
      verifiedAt: "2024-01-15T10:02:00Z"
    }
  }
];

async function createExecution() {
  const response = await fetch('http://localhost:3000/api/executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: TEMPLATE_ID,
      name: "DAO House P&L - No FSM",
      description: "Testing without FSM validation",
      externalEvents
    })
  });

  const result = await response.json();
  console.log('Execution ID:', result.executionId);
  console.log('URL:', `http://localhost:3000/template-editor/${TEMPLATE_ID}?execution=${result.executionId}`);
  return result.executionId;
}

createExecution();
