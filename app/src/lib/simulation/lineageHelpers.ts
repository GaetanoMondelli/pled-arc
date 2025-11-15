/**
 * Helper functions for enhanced lineage tracking in the simulation store
 */
import type {
  AggregationDetails,
  AggregationMethod,
  HistoryEntry,
  LineageMetadata,
  SourceTokenSummary,
  Token,
  TransformationDetails,
} from "./types";

/**
 * Calculate generation level for a token based on its source tokens
 */
export function calculateGenerationLevel(sourceTokens: Token[]): number {
  if (sourceTokens.length === 0) {
    return 0; // DataSource token (root)
  }

  // Find the maximum generation level among source tokens and add 1
  const maxSourceGeneration = Math.max(
    ...sourceTokens.map(token => {
      // Look for the most recent lineage metadata in the token's history
      const lineageEntry = token.history
        .slice()
        .reverse()
        .find(entry => entry.lineageMetadata?.generationLevel !== undefined);

      return lineageEntry?.lineageMetadata?.generationLevel ?? 0;
    }),
  );

  return maxSourceGeneration + 1;
}

/**
 * Extract ultimate source token IDs from source tokens
 */
export function extractUltimateSources(sourceTokens: Token[]): string[] {
  if (sourceTokens.length === 0) {
    return []; // This token itself will be considered a source
  }

  const ultimateSources = new Set<string>();

  sourceTokens.forEach(token => {
    // Look for existing ultimate sources in the token's lineage metadata
    const lineageEntry = token.history
      .slice()
      .reverse()
      .find(entry => entry.lineageMetadata?.ultimateSources);

    if (lineageEntry?.lineageMetadata?.ultimateSources) {
      lineageEntry.lineageMetadata.ultimateSources.forEach(sourceId => ultimateSources.add(sourceId));
    } else {
      // If no lineage metadata found, this token is likely a source itself
      ultimateSources.add(token.id);
    }
  });

  return Array.from(ultimateSources);
}

/**
 * Create detailed aggregation calculation breakdown
 */
export function createAggregationCalculation(
  method: AggregationMethod,
  inputTokens: Array<{ tokenId: string; value: any; contribution: number }>,
  resultValue: any,
): string {
  const tokenIds = inputTokens.map(t => t.tokenId);
  const rawValues = inputTokens.map(t => t.value);

  switch (method) {
    case "sum":
      const numValues = rawValues.map(v => Number(v));
      return `sum(${numValues.join(", ")}) = ${numValues.join(" + ")} = ${resultValue}`;

    case "average":
      const avgValues = rawValues.map(v => Number(v));
      const sum = avgValues.reduce((a, b) => a + b, 0);
      return `avg(${avgValues.join(", ")}) = (${avgValues.join(" + ")})/${avgValues.length} = ${sum}/${avgValues.length} = ${resultValue}`;

    case "count":
      return `count([${tokenIds.join(", ")}]) = ${rawValues.length}`;

    case "first":
      return `first([${tokenIds.join(", ")}]) = ${tokenIds[0]} (value: ${rawValues[0]})`;

    case "last":
      const lastIndex = rawValues.length - 1;
      return `last([${tokenIds.join(", ")}]) = ${tokenIds[lastIndex]} (value: ${rawValues[lastIndex]})`;

    default:
      return `${method}(${rawValues.join(", ")}) = ${resultValue}`;
  }
}

/**
 * Create enhanced aggregation details
 */
export function createAggregationDetails(
  method: AggregationMethod,
  sourceTokens: Token[],
  resultValue: any,
): AggregationDetails {
  const inputTokens = sourceTokens.map(token => {
    let contribution = 0;
    const numValue = Number(token.value);

    switch (method) {
      case "sum":
        contribution = numValue / sourceTokens.reduce((sum, t) => sum + Number(t.value), 0);
        break;
      case "average":
        contribution = numValue / sourceTokens.length;
        break;
      case "count":
        contribution = 1 / sourceTokens.length;
        break;
      case "first":
        contribution = token === sourceTokens[0] ? 1 : 0;
        break;
      case "last":
        contribution = token === sourceTokens[sourceTokens.length - 1] ? 1 : 0;
        break;
      default:
        contribution = 1 / sourceTokens.length;
    }

    return {
      tokenId: token.id,
      value: token.value,
      contribution,
    };
  });

  const calculation = createAggregationCalculation(method, inputTokens, resultValue);

  return {
    method,
    inputTokens,
    calculation,
    resultValue,
  };
}

/**
 * Create transformation calculation breakdown for ProcessNode operations
 */
export function createTransformationCalculation(
  formula: string,
  inputMapping: Record<string, any>,
  resultValue: any,
): string {
  // Create a human-readable representation of the formula evaluation
  let calculation = formula;

  // Replace input references with actual values
  Object.entries(inputMapping).forEach(([nodeId, tokenData]) => {
    const valueStr = `${tokenData.value}`;
    calculation = calculation.replace(new RegExp(`inputs\\.${nodeId}\\.value`, "g"), valueStr);
  });

  return `${formula} = ${calculation} = ${resultValue}`;
}

/**
 * Create enhanced transformation details
 */
export function createTransformationDetails(
  formula: string,
  inputMapping: Record<string, any>,
  resultValue: any,
): TransformationDetails {
  const calculation = createTransformationCalculation(formula, inputMapping, resultValue);

  return {
    formula,
    inputMapping,
    calculation,
    resultValue,
  };
}

/**
 * Create enhanced source token summaries with recursive lineage
 */
export function createEnhancedSourceTokenSummaries(sourceTokens: Token[]): SourceTokenSummary[] {
  return sourceTokens.map(token => {
    // Get generation level from the token's own lineage metadata, not by calculating from itself
    const lineageEntry = token.history
      .slice()
      .reverse()
      .find(entry => entry.lineageMetadata?.generationLevel !== undefined);

    const generationLevel = lineageEntry?.lineageMetadata?.generationLevel ?? 0;
    const ultimateSources = extractUltimateSources([token]);

    // Build complete lineage chain (simplified - just direct ancestors for now)
    const completeLineage = token.history
      .filter(entry => entry.sourceTokenIds && entry.sourceTokenIds.length > 0)
      .flatMap(entry => entry.sourceTokenIds || []);

    return {
      id: token.id,
      originNodeId: token.originNodeId,
      originalValue: token.value,
      createdAt: token.createdAt,
      completeLineage: Array.from(new Set(completeLineage)), // Remove duplicates
      generationLevel,
      ultimateSources,
    };
  });
}

/**
 * Create lineage metadata for a token operation
 */
export function createLineageMetadata(
  operationType: LineageMetadata["operationType"],
  sourceTokens: Token[],
  currentTokenId?: string,
): LineageMetadata {
  const generationLevel = calculateGenerationLevel(sourceTokens);
  let ultimateSources = extractUltimateSources(sourceTokens);

  // If this is a creation operation with no sources, this token is itself a source
  if (operationType === "creation" && sourceTokens.length === 0 && currentTokenId) {
    ultimateSources = [currentTokenId];
  }

  return {
    generationLevel,
    ultimateSources,
    operationType,
  };
}

/**
 * Determine operation type from action string
 */
export function determineOperationType(action: string): LineageMetadata["operationType"] {
  if (action === "CREATED") {
    return "creation";
  } else if (action.startsWith("AGGREGATED_")) {
    return "aggregation";
  } else if (action === "OUTPUT_GENERATED") {
    return "transformation";
  } else if (action.includes("CONSUMED")) {
    return "consumption";
  } else if (action.includes("FORWARDED") || action.includes("ARRIVED")) {
    return "transfer";
  }

  return "transfer"; // Default fallback
}
