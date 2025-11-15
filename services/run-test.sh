#!/bin/bash
# Quick test runner script

echo "🧪 Docling & Workflow Agent Test Suite"
echo "======================================"
echo ""

# Check if .env.local exists in parent app folder
if [ ! -f "../app/.env.local" ]; then
    echo "⚠️  Warning: ../app/.env.local not found"
    echo "   Environment variables will use defaults"
    echo ""
fi

# Load environment variables from app/.env.local if it exists
if [ -f "../app/.env.local" ]; then
    export $(cat ../app/.env.local | grep -v '^#' | xargs)
    echo "✓ Loaded environment variables from ../app/.env.local"
    echo ""
fi

# Show what we're testing
echo "📡 Services to test:"
echo "   Docling: ${DOCLING_SERVICE_URL:-https://a5fd808de8a8.ngrok-free.app}"
echo "   Workflow: ${WORKFLOW_AGENT_URL:-https://workflow-agent-319413928411.us-central1.run.app/chat}"
echo ""

# Clean up old test results
echo "🧹 Cleaning up old test results..."
rm -f docling-output.json test-docling-summary.txt test-docling-error.txt
rm -f workflow-agent-output.json test-workflow-agent-summary.txt test-workflow-agent-error.txt
rm -f complete-workflow-*.json complete-workflow-summary.json
echo ""

# Run the test
echo "🚀 Running test: $1"
echo "======================================"
echo ""

case "$1" in
  "docling")
    npm run test:docling
    ;;
  "workflow")
    npm run test:workflow
    ;;
  "complete")
    npm run test:complete
    ;;
  "all")
    npm test
    ;;
  *)
    echo "Usage: ./run-test.sh [docling|workflow|complete|all]"
    echo ""
    echo "Examples:"
    echo "  ./run-test.sh docling    # Test Docling service"
    echo "  ./run-test.sh workflow   # Test Workflow Agent"
    echo "  ./run-test.sh complete   # Test complete pipeline"
    echo "  ./run-test.sh all        # Run all tests"
    exit 1
    ;;
esac

# Show results
echo ""
echo "======================================"
echo "📊 Test Results"
echo "======================================"
echo ""

# List created files
echo "Files created:"
ls -lh *.json *.txt 2>/dev/null | grep -E "(docling|workflow|complete)" | awk '{print "  " $9 " (" $5 ")"}'
echo ""

# Show quick summary if available
if [ -f "test-docling-summary.txt" ]; then
    echo "📄 Docling Summary:"
    head -n 15 test-docling-summary.txt | sed 's/^/  /'
    echo ""
fi

if [ -f "test-workflow-agent-summary.txt" ]; then
    echo "🤖 Workflow Agent Summary:"
    head -n 15 test-workflow-agent-summary.txt | sed 's/^/  /'
    echo ""
fi

echo "✨ Done! Check the summary files above or read:"
echo "   cat test-docling-summary.txt"
echo "   cat test-workflow-agent-summary.txt"
echo ""
