/**
 * TokenLineageCache - Intelligent Caching for Token Lineage Data
 *
 * This module provides high-performance caching for computed token lineages
 * with intelligent invalidation strategies, memory management, and performance monitoring.
 */
import type { AncestorToken, SourceContribution, TokenLineage } from "./tokenGenealogyEngine";
import type { HistoryEntry } from "./types";

/**
 * Cache entry with metadata for intelligent invalidation
 */
interface CacheEntry {
  lineage: TokenLineage;
  computedAt: number;
  accessCount: number;
  lastAccessed: number;
  dependencies: Set<string>; // Token IDs this lineage depends on
  computationTime: number; // Time taken to compute (ms)
  memorySize: number; // Estimated memory usage (bytes)
}

/**
 * Cache statistics for performance monitoring
 */
export interface CacheStats {
  totalEntries: number;
  totalMemoryUsage: number;
  hitRate: number;
  averageComputationTime: number;
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxEntries: number;
  maxMemoryMB: number;
  ttlMs: number; // Time to live in milliseconds
  enableMetrics: boolean;
  evictionStrategy: "lru" | "lfu" | "ttl" | "memory";
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  maxMemoryMB: 50,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  enableMetrics: true,
  evictionStrategy: "lru",
};

/**
 * High-performance cache for token lineage data with intelligent invalidation
 */
export class TokenLineageCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalComputationTime: 0,
    totalComputations: 0,
  };
  private dependencyIndex = new Map<string, Set<string>>(); // tokenId -> Set of cache keys that depend on it
  private accessOrder: string[] = []; // For LRU eviction
  private frequencyMap = new Map<string, number>(); // For LFU eviction

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached lineage for a token
   */
  get(tokenId: string): TokenLineage | null {
    const entry = this.cache.get(tokenId);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.invalidate(tokenId);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(tokenId);
    this.updateFrequency(tokenId);
    this.stats.hits++;

    return entry.lineage;
  }

  /**
   * Store computed lineage in cache
   */
  set(tokenId: string, lineage: TokenLineage, computationTime: number = 0): void {
    // Calculate memory usage estimate
    const memorySize = this.estimateMemoryUsage(lineage);

    // Check if we need to evict entries before adding
    this.ensureCapacity(memorySize);

    // Extract dependencies from lineage
    const dependencies = this.extractDependencies(lineage);

    const entry: CacheEntry = {
      lineage,
      computedAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      dependencies,
      computationTime,
      memorySize,
    };

    // Store in cache
    this.cache.set(tokenId, entry);

    // Update dependency index
    this.updateDependencyIndex(tokenId, dependencies);

    // Update access tracking
    this.updateAccessOrder(tokenId);
    this.updateFrequency(tokenId);

    // Update statistics
    this.stats.totalComputationTime += computationTime;
    this.stats.totalComputations++;
  }

  /**
   * Invalidate a specific token's cached lineage
   */
  invalidate(tokenId: string): void {
    const entry = this.cache.get(tokenId);
    if (entry) {
      // Remove from cache
      this.cache.delete(tokenId);

      // Clean up dependency index
      this.removeDependencyIndex(tokenId, entry.dependencies);

      // Clean up access tracking
      this.removeFromAccessOrder(tokenId);
      this.frequencyMap.delete(tokenId);
    }
  }

  /**
   * Invalidate all cached lineages that depend on a specific token
   */
  invalidateDependents(changedTokenId: string): void {
    const dependentKeys = this.dependencyIndex.get(changedTokenId);
    if (dependentKeys) {
      for (const cacheKey of dependentKeys) {
        this.invalidate(cacheKey);
      }
    }
  }

  /**
   * Invalidate cache entries based on history changes
   */
  invalidateByHistoryChanges(newEntries: HistoryEntry[]): void {
    const affectedTokens = new Set<string>();

    // Extract token IDs from new history entries
    for (const entry of newEntries) {
      const tokenIdMatch = entry.details?.match(/Token (\w+)/);
      if (tokenIdMatch) {
        affectedTokens.add(tokenIdMatch[1]);
      }

      // Also consider source tokens
      if (entry.sourceTokenIds) {
        for (const sourceId of entry.sourceTokenIds) {
          affectedTokens.add(sourceId);
        }
      }
    }

    // Invalidate all affected tokens and their dependents
    for (const tokenId of affectedTokens) {
      this.invalidate(tokenId);
      this.invalidateDependents(tokenId);
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.dependencyIndex.clear();
    this.accessOrder = [];
    this.frequencyMap.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalMemoryUsage = entries.reduce((sum, entry) => sum + entry.memorySize, 0);
    const timestamps = entries.map(entry => entry.computedAt);

    return {
      totalEntries: this.cache.size,
      totalMemoryUsage,
      hitRate: this.stats.hits + this.stats.misses > 0 ? this.stats.hits / (this.stats.hits + this.stats.misses) : 0,
      averageComputationTime:
        this.stats.totalComputations > 0 ? this.stats.totalComputationTime / this.stats.totalComputations : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalEvictions: this.stats.evictions,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  /**
   * Perform cache maintenance (cleanup expired entries, optimize memory)
   */
  maintenance(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.invalidate(key);
    }

    // Perform memory-based eviction if needed
    this.ensureMemoryLimit();
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply new limits immediately
    this.ensureCapacity(0);
  }

  // Private helper methods

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.computedAt > this.config.ttlMs;
  }

  private estimateMemoryUsage(lineage: TokenLineage): number {
    // Rough estimation of memory usage in bytes
    let size = 0;

    // Target token
    size += 200; // Base object overhead

    // Ancestors
    size += lineage.allAncestors.length * 300; // Each ancestor with history

    // Descendants
    size += lineage.descendants.length * 200;

    // Source contributions
    size += lineage.sourceContributions.length * 150;

    // Generation levels
    size += lineage.generationLevels.length * 100;

    return size;
  }

  private extractDependencies(lineage: TokenLineage): Set<string> {
    const dependencies = new Set<string>();

    // Add target token
    dependencies.add(lineage.targetToken.id);

    // Add all ancestors
    for (const ancestor of lineage.allAncestors) {
      dependencies.add(ancestor.id);
    }

    // Add all descendants
    for (const descendant of lineage.descendants) {
      dependencies.add(descendant.id);
    }

    return dependencies;
  }

  private updateDependencyIndex(cacheKey: string, dependencies: Set<string>): void {
    for (const tokenId of dependencies) {
      if (!this.dependencyIndex.has(tokenId)) {
        this.dependencyIndex.set(tokenId, new Set());
      }
      this.dependencyIndex.get(tokenId)!.add(cacheKey);
    }
  }

  private removeDependencyIndex(cacheKey: string, dependencies: Set<string>): void {
    for (const tokenId of dependencies) {
      const dependents = this.dependencyIndex.get(tokenId);
      if (dependents) {
        dependents.delete(cacheKey);
        if (dependents.size === 0) {
          this.dependencyIndex.delete(tokenId);
        }
      }
    }
  }

  private updateAccessOrder(tokenId: string): void {
    // Remove from current position
    this.removeFromAccessOrder(tokenId);
    // Add to end (most recently used)
    this.accessOrder.push(tokenId);
  }

  private removeFromAccessOrder(tokenId: string): void {
    const index = this.accessOrder.indexOf(tokenId);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateFrequency(tokenId: string): void {
    const current = this.frequencyMap.get(tokenId) || 0;
    this.frequencyMap.set(tokenId, current + 1);
  }

  private ensureCapacity(newEntrySize: number): void {
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries) {
      this.evictOne();
    }

    // Check memory limit
    this.ensureMemoryLimit(newEntrySize);
  }

  private ensureMemoryLimit(additionalSize: number = 0): void {
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024;
    let currentUsage = this.getCurrentMemoryUsage() + additionalSize;

    while (currentUsage > maxBytes && this.cache.size > 0) {
      this.evictOne();
      currentUsage = this.getCurrentMemoryUsage() + additionalSize;
    }
  }

  private getCurrentMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.memorySize;
    }
    return total;
  }

  private evictOne(): void {
    let keyToEvict: string | null = null;

    switch (this.config.evictionStrategy) {
      case "lru":
        keyToEvict = this.accessOrder[0] || null;
        break;

      case "lfu":
        keyToEvict = this.findLeastFrequentlyUsed();
        break;

      case "ttl":
        keyToEvict = this.findOldestEntry();
        break;

      case "memory":
        keyToEvict = this.findLargestEntry();
        break;
    }

    if (keyToEvict) {
      this.invalidate(keyToEvict);
      this.stats.evictions++;
    }
  }

  private findLeastFrequentlyUsed(): string | null {
    let minFreq = Infinity;
    let leastUsed: string | null = null;

    for (const [key, freq] of this.frequencyMap) {
      if (this.cache.has(key) && freq < minFreq) {
        minFreq = freq;
        leastUsed = key;
      }
    }

    return leastUsed;
  }

  private findOldestEntry(): string | null {
    let oldestTime = Infinity;
    let oldest: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.computedAt < oldestTime) {
        oldestTime = entry.computedAt;
        oldest = key;
      }
    }

    return oldest;
  }

  private findLargestEntry(): string | null {
    let maxSize = 0;
    let largest: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.memorySize > maxSize) {
        maxSize = entry.memorySize;
        largest = key;
      }
    }

    return largest;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalComputationTime: 0,
      totalComputations: 0,
    };
  }
}

/**
 * Global cache instance with default configuration
 */
export const globalLineageCache = new TokenLineageCache();

/**
 * Utility function to create a cache with custom configuration
 */
export function createLineageCache(config?: Partial<CacheConfig>): TokenLineageCache {
  return new TokenLineageCache(config);
}

/**
 * Cache-aware wrapper for lineage computation
 */
export function getCachedLineage(
  tokenId: string,
  computeLineage: () => TokenLineage,
  cache: TokenLineageCache = globalLineageCache,
): TokenLineage {
  // Try to get from cache first
  const cached = cache.get(tokenId);
  if (cached) {
    return cached;
  }

  // Compute lineage and measure time
  const startTime = performance.now();
  const lineage = computeLineage();
  const computationTime = performance.now() - startTime;

  // Store in cache
  cache.set(tokenId, lineage, computationTime);

  return lineage;
}

/**
 * Batch invalidation for multiple tokens
 */
export function batchInvalidate(tokenIds: string[], cache: TokenLineageCache = globalLineageCache): void {
  for (const tokenId of tokenIds) {
    cache.invalidate(tokenId);
    cache.invalidateDependents(tokenId);
  }
}

/**
 * Smart cache warming - precompute lineages for frequently accessed tokens
 */
export function warmCache(
  tokenIds: string[],
  computeLineage: (tokenId: string) => TokenLineage,
  cache: TokenLineageCache = globalLineageCache,
): Promise<void> {
  return new Promise(resolve => {
    // Use setTimeout to avoid blocking the main thread
    let index = 0;

    function processNext() {
      if (index >= tokenIds.length) {
        resolve();
        return;
      }

      const tokenId = tokenIds[index++];

      // Only compute if not already cached
      if (!cache.get(tokenId)) {
        try {
          const startTime = performance.now();
          const lineage = computeLineage(tokenId);
          const computationTime = performance.now() - startTime;
          cache.set(tokenId, lineage, computationTime);
        } catch (error) {
          console.warn(`Failed to warm cache for token ${tokenId}:`, error);
        }
      }

      // Process next token in next tick
      setTimeout(processNext, 0);
    }

    processNext();
  });
}
