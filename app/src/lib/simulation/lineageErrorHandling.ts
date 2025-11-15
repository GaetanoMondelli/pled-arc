/**
 * Comprehensive Error Handling and User Feedback for Token Lineage System
 *
 * This module provides robust error handling, recovery strategies, and user feedback
 * for the enhanced token lineage system. It handles circular references, missing tokens,
 * incomplete lineage chains, and performance limits with graceful degradation.
 */
import type { AncestorToken, TokenLineage } from "./tokenGenealogyEngine";
import type { HistoryEntry } from "./types";

/**
 * Error types for lineage computation
 */
export type LineageErrorType =
  | "circular_reference"
  | "missing_token"
  | "incomplete_lineage"
  | "performance_limit"
  | "computation_timeout"
  | "invalid_data"
  | "network_error"
  | "cache_error";

/**
 * Severity levels for lineage errors
 */
export type LineageErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Detailed error information for lineage computation
 */
export interface LineageError {
  type: LineageErrorType;
  severity: LineageErrorSeverity;
  tokenId: string;
  message: string;
  technicalDetails?: string;
  affectedTokens: string[];
  suggestedAction: string;
  recoveryOptions: LineageRecoveryOption[];
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * Recovery options for handling lineage errors
 */
export interface LineageRecoveryOption {
  id: string;
  label: string;
  description: string;
  action: "retry" | "partial" | "skip" | "fallback" | "manual";
  isRecommended: boolean;
  estimatedTime?: number; // in milliseconds
}

/**
 * Result of lineage computation with error handling
 */
export interface LineageComputationResult {
  success: boolean;
  lineage?: TokenLineage;
  partialLineage?: Partial<TokenLineage>;
  errors: LineageError[];
  warnings: LineageWarning[];
  computationTime: number;
  cacheHit: boolean;
  recoveryApplied?: string;
}

/**
 * Warning information for lineage computation
 */
export interface LineageWarning {
  type: "performance" | "data_quality" | "incomplete_data" | "deprecated_feature";
  message: string;
  tokenId?: string;
  affectedTokens: string[];
  suggestion?: string;
}

/**
 * Loading state information for complex lineage calculations
 */
export interface LineageLoadingState {
  isLoading: boolean;
  stage: "initializing" | "building_graph" | "traversing" | "calculating_contributions" | "finalizing";
  progress: number; // 0-100
  currentOperation?: string;
  estimatedTimeRemaining?: number; // in milliseconds
  tokensProcessed: number;
  totalTokens: number;
}

/**
 * Configuration for error handling behavior
 */
export interface LineageErrorConfig {
  maxComputationTime: number; // milliseconds
  maxTraversalDepth: number;
  maxTokensToProcess: number;
  enablePartialResults: boolean;
  enableRetryMechanism: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableCircularReferenceDetection: boolean;
  enablePerformanceWarnings: boolean;
}

/**
 * Default error handling configuration
 */
export const DEFAULT_ERROR_CONFIG: LineageErrorConfig = {
  maxComputationTime: 30000, // 30 seconds
  maxTraversalDepth: 50,
  maxTokensToProcess: 10000,
  enablePartialResults: true,
  enableRetryMechanism: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  enableCircularReferenceDetection: true,
  enablePerformanceWarnings: true,
};

/**
 * Comprehensive error handler for token lineage operations
 */
export class LineageErrorHandler {
  private config: LineageErrorConfig;
  private errorHistory: Map<string, LineageError[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<LineageErrorConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }

  /**
   * Create a lineage error with appropriate severity and recovery options
   */
  createError(
    type: LineageErrorType,
    tokenId: string,
    message: string,
    affectedTokens: string[] = [],
    context?: Record<string, any>,
  ): LineageError {
    const severity = this.determineSeverity(type, affectedTokens.length);
    const recoveryOptions = this.generateRecoveryOptions(type, tokenId, affectedTokens);

    const error: LineageError = {
      type,
      severity,
      tokenId,
      message,
      technicalDetails: this.generateTechnicalDetails(type, context),
      affectedTokens: [tokenId, ...affectedTokens],
      suggestedAction: this.generateSuggestedAction(type, severity),
      recoveryOptions,
      timestamp: Date.now(),
      context,
    };

    // Store error in history
    this.addToErrorHistory(tokenId, error);

    return error;
  }

  /**
   * Handle circular reference detection
   */
  handleCircularReference(tokenId: string, cycle: string[], context?: Record<string, any>): LineageError {
    return this.createError(
      "circular_reference",
      tokenId,
      `Circular reference detected in token lineage: ${cycle.join(" → ")} → ${cycle[0]}`,
      cycle,
      { cycle, ...context },
    );
  }

  /**
   * Handle missing token data
   */
  handleMissingToken(tokenId: string, referencingTokens: string[] = [], context?: Record<string, any>): LineageError {
    return this.createError(
      "missing_token",
      tokenId,
      `Token ${tokenId} not found in simulation history`,
      referencingTokens,
      { referencingTokens, ...context },
    );
  }

  /**
   * Handle incomplete lineage chains
   */
  handleIncompleteLineage(tokenId: string, missingLinks: string[], context?: Record<string, any>): LineageError {
    return this.createError(
      "incomplete_lineage",
      tokenId,
      `Incomplete lineage chain detected. Missing tokens: ${missingLinks.join(", ")}`,
      missingLinks,
      { missingLinks, ...context },
    );
  }

  /**
   * Handle performance limit exceeded
   */
  handlePerformanceLimit(
    tokenId: string,
    limitType: "time" | "depth" | "tokens",
    actualValue: number,
    limitValue: number,
    context?: Record<string, any>,
  ): LineageError {
    const message = `Performance limit exceeded: ${limitType} (${actualValue} > ${limitValue})`;

    return this.createError("performance_limit", tokenId, message, [], {
      limitType,
      actualValue,
      limitValue,
      ...context,
    });
  }

  /**
   * Handle computation timeout
   */
  handleComputationTimeout(tokenId: string, timeoutMs: number, context?: Record<string, any>): LineageError {
    return this.createError("computation_timeout", tokenId, `Lineage computation timed out after ${timeoutMs}ms`, [], {
      timeoutMs,
      ...context,
    });
  }

  /**
   * Generate recovery options based on error type
   */
  private generateRecoveryOptions(
    type: LineageErrorType,
    tokenId: string,
    affectedTokens: string[],
  ): LineageRecoveryOption[] {
    const options: LineageRecoveryOption[] = [];

    switch (type) {
      case "circular_reference":
        options.push(
          {
            id: "break_cycle",
            label: "Break Circular Reference",
            description: "Remove the circular dependency and show partial lineage",
            action: "partial",
            isRecommended: true,
            estimatedTime: 2000,
          },
          {
            id: "skip_problematic",
            label: "Skip Problematic Tokens",
            description: "Exclude tokens involved in the circular reference",
            action: "skip",
            isRecommended: false,
          },
        );
        break;

      case "missing_token":
        options.push(
          {
            id: "show_partial",
            label: "Show Partial Lineage",
            description: "Display available lineage information without missing tokens",
            action: "partial",
            isRecommended: true,
            estimatedTime: 1000,
          },
          {
            id: "retry_with_refresh",
            label: "Retry with Data Refresh",
            description: "Refresh simulation data and retry lineage computation",
            action: "retry",
            isRecommended: false,
            estimatedTime: 5000,
          },
        );
        break;

      case "incomplete_lineage":
        options.push(
          {
            id: "show_available",
            label: "Show Available Lineage",
            description: "Display the lineage information that could be computed",
            action: "partial",
            isRecommended: true,
            estimatedTime: 1500,
          },
          {
            id: "fallback_simple",
            label: "Use Simple Lineage",
            description: "Fall back to basic parent-child relationships",
            action: "fallback",
            isRecommended: false,
            estimatedTime: 500,
          },
        );
        break;

      case "performance_limit":
        options.push(
          {
            id: "reduce_scope",
            label: "Reduce Scope",
            description: "Limit the lineage depth or number of tokens processed",
            action: "partial",
            isRecommended: true,
            estimatedTime: 3000,
          },
          {
            id: "background_compute",
            label: "Compute in Background",
            description: "Process the full lineage in the background",
            action: "retry",
            isRecommended: false,
            estimatedTime: 30000,
          },
        );
        break;

      case "computation_timeout":
        options.push(
          {
            id: "extend_timeout",
            label: "Extend Timeout",
            description: "Increase the computation timeout and retry",
            action: "retry",
            isRecommended: true,
            estimatedTime: 60000,
          },
          {
            id: "partial_result",
            label: "Use Partial Result",
            description: "Display the lineage computed before timeout",
            action: "partial",
            isRecommended: false,
          },
        );
        break;

      default:
        options.push({
          id: "retry_default",
          label: "Retry",
          description: "Retry the lineage computation",
          action: "retry",
          isRecommended: true,
          estimatedTime: 5000,
        });
    }

    return options;
  }

  /**
   * Determine error severity based on type and impact
   */
  private determineSeverity(type: LineageErrorType, affectedTokenCount: number): LineageErrorSeverity {
    switch (type) {
      case "circular_reference":
        return affectedTokenCount > 10 ? "high" : "medium";

      case "missing_token":
        return affectedTokenCount > 5 ? "high" : "medium";

      case "incomplete_lineage":
        return affectedTokenCount > 20 ? "high" : "medium";

      case "performance_limit":
      case "computation_timeout":
        return "medium";

      case "invalid_data":
        return "high";

      case "network_error":
      case "cache_error":
        return "low";

      default:
        return "medium";
    }
  }

  /**
   * Generate technical details for debugging
   */
  private generateTechnicalDetails(type: LineageErrorType, context?: Record<string, any>): string {
    const details: string[] = [];

    details.push(`Error Type: ${type}`);
    details.push(`Timestamp: ${new Date().toISOString()}`);

    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        details.push(`${key}: ${JSON.stringify(value)}`);
      });
    }

    return details.join("\n");
  }

  /**
   * Generate user-friendly suggested action
   */
  private generateSuggestedAction(type: LineageErrorType, severity: LineageErrorSeverity): string {
    switch (type) {
      case "circular_reference":
        return severity === "high"
          ? "Review the simulation logic to eliminate circular dependencies between tokens"
          : "Consider showing partial lineage without the circular reference";

      case "missing_token":
        return "Verify that all referenced tokens exist in the simulation history";

      case "incomplete_lineage":
        return "Check for missing or corrupted simulation data";

      case "performance_limit":
        return "Consider reducing the lineage scope or increasing performance limits";

      case "computation_timeout":
        return "Try increasing the computation timeout or reducing the lineage complexity";

      default:
        return "Try refreshing the data or contact support if the issue persists";
    }
  }

  /**
   * Add error to history for tracking
   */
  private addToErrorHistory(tokenId: string, error: LineageError): void {
    if (!this.errorHistory.has(tokenId)) {
      this.errorHistory.set(tokenId, []);
    }

    const history = this.errorHistory.get(tokenId)!;
    history.push(error);

    // Keep only the last 10 errors per token
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Get error history for a token
   */
  getErrorHistory(tokenId: string): LineageError[] {
    return this.errorHistory.get(tokenId) || [];
  }

  /**
   * Check if retry should be attempted
   */
  shouldRetry(tokenId: string, error: LineageError): boolean {
    if (!this.config.enableRetryMechanism) {
      return false;
    }

    const attempts = this.retryAttempts.get(tokenId) || 0;
    if (attempts >= this.config.maxRetryAttempts) {
      return false;
    }

    // Don't retry certain error types
    const nonRetryableErrors: LineageErrorType[] = ["circular_reference", "invalid_data"];
    if (nonRetryableErrors.includes(error.type)) {
      return false;
    }

    return true;
  }

  /**
   * Record retry attempt
   */
  recordRetryAttempt(tokenId: string): void {
    const attempts = this.retryAttempts.get(tokenId) || 0;
    this.retryAttempts.set(tokenId, attempts + 1);
  }

  /**
   * Reset retry counter
   */
  resetRetryCounter(tokenId: string): void {
    this.retryAttempts.delete(tokenId);
  }

  /**
   * Generate warnings for potential issues
   */
  generateWarnings(
    tokenId: string,
    lineage: Partial<TokenLineage>,
    computationTime: number,
    context?: Record<string, any>,
  ): LineageWarning[] {
    const warnings: LineageWarning[] = [];

    // Performance warning
    if (this.config.enablePerformanceWarnings && computationTime > 10000) {
      warnings.push({
        type: "performance",
        message: `Lineage computation took ${computationTime}ms, which may impact user experience`,
        tokenId,
        affectedTokens: [tokenId],
        suggestion: "Consider enabling caching or reducing lineage depth",
      });
    }

    // Deep lineage warning
    if (lineage.generationLevels && lineage.generationLevels.length > 20) {
      warnings.push({
        type: "performance",
        message: `Very deep lineage detected (${lineage.generationLevels.length} generations)`,
        tokenId,
        affectedTokens: [tokenId],
        suggestion: "Consider limiting the lineage depth for better performance",
      });
    }

    // Large number of ancestors warning
    if (lineage.allAncestors && lineage.allAncestors.length > 1000) {
      warnings.push({
        type: "performance",
        message: `Large number of ancestor tokens (${lineage.allAncestors.length})`,
        tokenId,
        affectedTokens: [tokenId],
        suggestion: "Consider using pagination or filtering for better user experience",
      });
    }

    // Data quality warnings
    if (lineage.allAncestors) {
      const tokensWithoutHistory = lineage.allAncestors.filter(
        a => !a.completeHistory || a.completeHistory.length === 0,
      );
      if (tokensWithoutHistory.length > 0) {
        warnings.push({
          type: "data_quality",
          message: `${tokensWithoutHistory.length} tokens have incomplete history data`,
          tokenId,
          affectedTokens: tokensWithoutHistory.map(t => t.id),
          suggestion: "Some lineage details may be missing due to incomplete history",
        });
      }
    }

    return warnings;
  }

  /**
   * Create partial lineage when full computation fails
   */
  createPartialLineage(
    tokenId: string,
    availableData: {
      targetToken?: any;
      immediateParents?: any[];
      someAncestors?: AncestorToken[];
      errors: LineageError[];
    },
  ): Partial<TokenLineage> {
    const partialLineage: Partial<TokenLineage> = {};

    if (availableData.targetToken) {
      partialLineage.targetToken = availableData.targetToken;
    }

    if (availableData.immediateParents) {
      partialLineage.immediateParents = availableData.immediateParents;
    }

    if (availableData.someAncestors) {
      partialLineage.allAncestors = availableData.someAncestors;

      // Build generation levels from available ancestors
      const generationMap = new Map<number, AncestorToken[]>();
      availableData.someAncestors.forEach(ancestor => {
        const level = ancestor.generationLevel;
        if (!generationMap.has(level)) {
          generationMap.set(level, []);
        }
        generationMap.get(level)!.push(ancestor);
      });

      partialLineage.generationLevels = Array.from(generationMap.entries()).map(([level, tokens]) => ({
        level,
        tokens,
        description: `Generation ${level} (partial data)`,
      }));
    }

    // Set empty arrays for missing data
    partialLineage.descendants = partialLineage.descendants || [];
    partialLineage.sourceContributions = partialLineage.sourceContributions || [];

    return partialLineage;
  }

  /**
   * Validate lineage data for potential issues
   */
  validateLineageData(globalLog: HistoryEntry[]): LineageError[] {
    const errors: LineageError[] = [];
    const tokenIds = new Set<string>();
    const tokenReferences = new Map<string, string[]>();

    // Extract token information from history
    for (const entry of globalLog) {
      const tokenIdMatch = entry.details?.match(/Token (\w+)/);
      if (tokenIdMatch) {
        const tokenId = tokenIdMatch[1];
        tokenIds.add(tokenId);

        // Track token references
        if (entry.sourceTokenIds) {
          tokenReferences.set(tokenId, entry.sourceTokenIds);
        }
      }
    }

    // Check for missing token references
    for (const [tokenId, sourceIds] of tokenReferences) {
      for (const sourceId of sourceIds) {
        if (!tokenIds.has(sourceId)) {
          errors.push(
            this.handleMissingToken(sourceId, [tokenId], {
              referencedBy: tokenId,
              validationContext: "data_validation",
            }),
          );
        }
      }
    }

    return errors;
  }

  /**
   * Clear error history and retry counters
   */
  clearHistory(): void {
    this.errorHistory.clear();
    this.retryAttempts.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): LineageErrorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LineageErrorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Utility function to create user-friendly error messages
 */
export function formatErrorMessage(error: LineageError): string {
  const prefix =
    error.severity === "critical" ? "🚨" : error.severity === "high" ? "⚠️" : error.severity === "medium" ? "⚡" : "ℹ️";

  return `${prefix} ${error.message}`;
}

/**
 * Utility function to format technical details for debugging
 */
export function formatTechnicalDetails(error: LineageError): string {
  const details = [
    `Error ID: ${error.type}`,
    `Token: ${error.tokenId}`,
    `Severity: ${error.severity}`,
    `Timestamp: ${new Date(error.timestamp).toLocaleString()}`,
    `Affected Tokens: ${error.affectedTokens.join(", ")}`,
  ];

  if (error.technicalDetails) {
    details.push("Technical Details:", error.technicalDetails);
  }

  return details.join("\n");
}

/**
 * Utility function to get error color for UI display
 */
export function getErrorColor(severity: LineageErrorSeverity): string {
  switch (severity) {
    case "critical":
      return "text-red-600 bg-red-50 border-red-200";
    case "high":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "medium":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "low":
      return "text-blue-600 bg-blue-50 border-blue-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

/**
 * Create a default error handler instance
 */
export const defaultLineageErrorHandler = new LineageErrorHandler();
