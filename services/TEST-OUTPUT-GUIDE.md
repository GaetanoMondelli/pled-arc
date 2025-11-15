# Test Output Files Guide

This document explains all the files created by the test suite so you can easily check the results.

## Running Tests

```bash
cd services

# Test individual services
npm run test:docling      # Test Docling service
npm run test:workflow     # Test Workflow Agent
npm run test:complete     # Test complete pipeline

# Or run all tests
npm test
```

## Output Files Created

### Docling Service Test (`npm run test:docling`)

**Success:**
- `docling-output.json` - Full JSON response from Docling
- `test-docling-summary.txt` - **Human-readable summary** ⭐ Check this first!

**Failure:**
- `test-docling-error.txt` - Error details if test fails

### Workflow Agent Test (`npm run test:workflow`)

**Success:**
- `workflow-agent-output.json` - Full JSON responses from both test cases
- `test-workflow-agent-summary.txt` - **Human-readable summary** ⭐ Check this first!

**Failure:**
- `test-workflow-agent-error.txt` - Error details if test fails

### Complete Workflow Test (`npm run test:complete`)

**Success:**
- `complete-workflow-docling.json` - Docling parsing result
- `complete-workflow-agent.json` - Workflow Agent DSL suggestions
- `complete-workflow-summary.json` - Pipeline summary with both steps

**Failure:**
- Error details printed to console and saved to file

## Quick Check After Running Tests

1. **Look for .txt summary files first** - they're human-readable
2. **Check .json files for full details** - complete API responses
3. **If test failed**, check the `-error.txt` file

## Example: Checking Docling Test Results

After running `npm run test:docling`:

```bash
# Quick check - human readable
cat test-docling-summary.txt

# Full details
cat docling-output.json | head -n 50

# If it failed
cat test-docling-error.txt
```

## File Locations

All output files are saved in `/services/` directory:

```
/services/
├── document.pdf                          # Input document
├── docling-output.json                   # Docling response
├── test-docling-summary.txt              # ⭐ Read this
├── workflow-agent-output.json            # Agent responses
├── test-workflow-agent-summary.txt       # ⭐ Read this
├── complete-workflow-docling.json        # Pipeline step 1
├── complete-workflow-agent.json          # Pipeline step 2
├── complete-workflow-summary.json        # Pipeline summary
└── (error files if tests fail)
```

## What Each Service Returns

### Docling Service
Expects to return:
- `text` or `content` - Extracted text from PDF
- `metadata` - Document metadata
- Other fields depending on document type

### Workflow Agent
Expects to return:
- `reply` or `response` or `message` - AI-generated DSL suggestions
- May include structured data about workflows

## Troubleshooting

**No files created?**
- Test crashed before reaching save point
- Check console output for errors

**Empty files?**
- API returned empty response
- Check API endpoint URLs in `.env.local`

**Connection errors?**
- Check if ngrok tunnel is active (Docling)
- Check if Cloud Run service is deployed (Workflow Agent)
- Verify URLs in `../app/.env.local`
