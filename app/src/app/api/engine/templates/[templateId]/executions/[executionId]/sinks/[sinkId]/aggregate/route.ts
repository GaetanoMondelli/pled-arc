import { NextRequest, NextResponse } from 'next/server';
import { AggregationFormulaType } from '@/core/types/claims';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string; sinkId: string }> }
) {
  try {
    const { templateId, executionId, sinkId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const formulaType = (searchParams.get('formula') || 'latest') as AggregationFormulaType;
    const customExpression = searchParams.get('customExpression');

    console.log(`🔍 DEBUGGING API: Aggregating sink data for template=${templateId}, execution=${executionId}, sink=${sinkId}, formula=${formulaType}`);

    // Base URL for internal API calls - use actual request host
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // 1. Use the step API to get simulation state at the end
    const stepUrl = `${baseUrl}/api/engine/templates/${templateId}/executions/${executionId}/step?currentStep=end`;
    console.log(`🔍 Fetching simulation state from: ${stepUrl}`);

    const stepResponse = await fetch(stepUrl);

    if (!stepResponse.ok) {
      const errorData = await stepResponse.json();
      return NextResponse.json({
        error: errorData.error || 'Failed to fetch simulation state',
        details: errorData
      }, { status: stepResponse.status });
    }

    const stepData = await stepResponse.json();

    console.log(`🔍 DEBUGGING: stepData received:`, {
      step: stepData.step,
      totalActivities: stepData.allActivities?.length,
      queueSize: stepData.queueSize
    });

    // 2. Filter allActivities for token_consumed events at this sink
    const allActivities = stepData.allActivities || [];
    const sinkEvents = allActivities.filter((entry: any) =>
      entry.nodeId === sinkId && entry.action === 'token_consumed'
    );

    console.log(`🎯 Found ${sinkEvents.length} token_consumed events for sink ${sinkId} from ${allActivities.length} total activities`);
    console.log(`🔍 DEBUGGING API: Sink events:`, sinkEvents.map((e: any) => ({ action: e.action, value: e.value, nodeId: e.nodeId })));

    // 4. Apply aggregation formula
    const aggregatedValue = await applySinkAggregation(sinkEvents, formulaType, customExpression);

    return NextResponse.json({
      templateId,
      executionId,
      sinkId,
      sinkType: 'Sink',
      formula: formulaType,
      customExpression,
      aggregatedValue,
      totalEvents: sinkEvents.length,
      totalActivityLogEntries: allActivities.length,
      events: sinkEvents,
      timestamp: new Date().toISOString(),
      dataSource: "step_api_endpoint"
    });

  } catch (error) {
    console.error('❌ Error aggregating sink data:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Apply aggregation formula to sink ledger entries
 */
async function applySinkAggregation(
  events: any[],
  formulaType: AggregationFormulaType,
  customExpression?: string | null
): Promise<any> {
  if (events.length === 0) {
    return null;
  }

  console.log(`🔍 AGGREGATION DEBUG: Processing ${events.length} ledger entries for sink`);

  // Transform events to ledger entries format expected by the formula
  const ledgerEntries = events.map((e, index) => ({
    id: e.id || `entry_${index}`,
    value: extractValue(e),
    timestamp: e.timestamp || Date.now(),
    action: e.action,
    nodeId: e.nodeId,
    originalEvent: e
  }));

  console.log(`🔍 AGGREGATION DEBUG: Transformed to ledger entries:`, ledgerEntries.map(e => ({ id: e.id, value: e.value, action: e.action })));

  // Extract numeric values for basic aggregations
  const numericValues = ledgerEntries
    .map(e => e.value)
    .filter(v => typeof v === 'number') as number[];

  console.log(`🔍 AGGREGATION DEBUG: Numeric values extracted:`, numericValues);

  // Always use custom expression evaluation for maximum flexibility
  let evaluationExpression = customExpression;

  // CRITICAL FIX: Handle case where formulaType='custom' but no valid customExpression
  // This happens with broken claims that have type='custom' but customExpression=undefined
  if (!evaluationExpression || evaluationExpression.trim() === '' || evaluationExpression.trim().length < 5) {
    console.warn(`⚠️ API FALLBACK: formulaType='${formulaType}' but no valid customExpression! Using built-in formula.`);

    // Use preset formula based on formulaType, defaulting to 'sum' if type is 'custom' with no expression
    const fallbackType = (formulaType === 'custom') ? 'sum' : formulaType;

    switch (fallbackType) {
      case 'sum':
        evaluationExpression = 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)';
        break;
      case 'count':
        evaluationExpression = 'ledgerEntries.length';
        break;
      case 'average':
        evaluationExpression = 'ledgerEntries.length > 0 ? ledgerEntries.reduce((sum, e) => sum + e.value, 0) / ledgerEntries.length : 0';
        break;
      case 'latest':
        evaluationExpression = 'ledgerEntries[ledgerEntries.length - 1] || null';
        break;
      case 'earliest':
        evaluationExpression = 'ledgerEntries[0] || null';
        break;
      case 'min':
        evaluationExpression = 'Math.min(...ledgerEntries.map(e => e.value).filter(v => typeof v === "number"))';
        break;
      case 'max':
        evaluationExpression = 'Math.max(...ledgerEntries.map(e => e.value).filter(v => typeof v === "number"))';
        break;
      default:
        evaluationExpression = 'ledgerEntries.reduce((sum, e) => sum + e.value, 0)'; // Default to sum
    }
  }

  console.log(`🔍 AGGREGATION DEBUG: Using expression: ${evaluationExpression}`);

  try {
    // Create safe evaluation context with ledgerEntries instead of sinks
    const safeContext = {
      ledgerEntries,
      entries: ledgerEntries, // alias
      events: ledgerEntries,   // legacy alias
      numericValues,
      Math,
      console: { log: console.log }, // Limited console access
    };

    console.log(`🔍 CUSTOM EXPRESSION DEBUG: Evaluating "${evaluationExpression}" with ${ledgerEntries.length} ledger entries`);
    console.log(`🔍 EXPRESSION DETAILS:`, {
      length: evaluationExpression?.length,
      type: typeof evaluationExpression,
      raw: evaluationExpression,
      escaped: JSON.stringify(evaluationExpression)
    });

    // Sanity check - should never reach here with invalid expression after our fix above
    if (!evaluationExpression || typeof evaluationExpression !== 'string' || evaluationExpression.trim() === '') {
      throw new Error(`Invalid expression after fallback handling: ${JSON.stringify(evaluationExpression)}`);
    }

    // CRITICAL FIX: Strip inline comments from expression
    // Comments like "// comment" break when wrapped in return statement
    // Example: "sum + e.value // comment" becomes invalid when wrapped as "return (sum + e.value // comment);"
    const expressionWithoutComments = evaluationExpression
      .split('\n')
      .map(line => {
        // Remove // comments but preserve string literals
        const commentIndex = line.indexOf('//');
        if (commentIndex !== -1) {
          // Check if // is inside a string literal
          const beforeComment = line.substring(0, commentIndex);
          const singleQuotes = (beforeComment.match(/'/g) || []).length;
          const doubleQuotes = (beforeComment.match(/"/g) || []).length;
          const backticks = (beforeComment.match(/`/g) || []).length;

          // If quotes are balanced, the // is not in a string
          if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0) {
            return beforeComment.trim();
          }
        }
        return line;
      })
      .join('\n')
      .trim();

    console.log(`🔍 EXPRESSION AFTER COMMENT REMOVAL: ${expressionWithoutComments}`);

    // Check for common syntax issues
    const functionCode = `
      const { ledgerEntries, entries, events, numericValues, Math, console } = ctx;
      return (${expressionWithoutComments});
    `;

    console.log(`🔍 GENERATED FUNCTION CODE:`, functionCode);

    // Use Function constructor for safe evaluation (no access to global scope)
    const func = new Function('ctx', functionCode);

    return func(safeContext);
  } catch (error) {
    console.error('❌ Custom expression evaluation failed:', error);
    throw new Error(`Custom expression evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract numeric value from event data
 */
function extractValue(event: any): any {
  if (typeof event.value === 'number') return event.value;
  if (event.value && typeof event.value.amount === 'number') return event.value.amount;
  if (event.value && typeof event.value.value === 'number') return event.value.value;
  return event.value;
}