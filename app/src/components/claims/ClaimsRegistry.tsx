"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Filter, Eye, Edit, Trash2, User, FileText, Activity, Coins, CheckCircle, AlertCircle } from "lucide-react";
import { createUserClaimsService } from "@/lib/services/claimsService";
import { useSession } from "next-auth/react";
import {
  Claim,
  ClaimSearchCriteria,
  ClaimSearchResult,
  ClaimStatus,
  ClaimFormulaType,
} from "@/core/types/claims";
import { ClaimDetailsModal } from "./ClaimDetailsModal";
import { SimpleClaimCreator } from "./SimpleClaimCreator";
import { CompactSinkViewer } from "./CompactSinkViewer";
import { JSONViewerModal } from "./JSONViewerModal";
import { ClaimEditModal } from "./ClaimEditModal";
import { TokenizeClaimModal } from "./TokenizeClaimModal";
import { TokenizationStatusModal } from "./TokenizationStatusModal";
import { templateService } from "@/lib/template-service";
import { engineAPIService } from "@/lib/engine-api-service";
import { computeClaimSyncStatus } from "@/lib/services/claimSyncService";
import { appendEventsOnChain, getClaimState } from "@/lib/services/claimContractService";

interface ClaimsRegistryState {
  claims: Claim[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: ClaimStatus | "all";
  formulaTypeFilter: ClaimFormulaType | "all";
  ownerFilter: string;
  total: number;
  hasMore: boolean;
  selectedClaim: Claim | null;
  showTemplateSelector: boolean;
  showDetailsModal: boolean;
  showEnhancedSinkViewer: boolean;
  sinkViewerClaim: Claim | null;
  showJSONViewer: boolean;
  jsonViewerClaim: Claim | null;
  showEditModal: boolean;
  editClaim: Claim | null;
  showTokenizeModal: boolean;
  tokenizeClaim: Claim | null;
  showOnChainStatusModal: boolean;
  onChainStatusClaim: Claim | null;
  aggregatedValues: Record<string, any>; // Cache for aggregated values by claim ID
  loadingAggregations: Record<string, boolean>; // Track loading state per claim
  onChainAggregateValues: Record<string, string>; // Cache for on-chain aggregate values by claim ID
}

export function ClaimsRegistry() {
  const { data: session } = useSession();
  const [userClaimsService, setUserClaimsService] = useState<any>(null);
  const [state, setState] = useState<ClaimsRegistryState>({
    claims: [],
    isLoading: true,
    error: null,
    searchQuery: "",
    statusFilter: "all",
    formulaTypeFilter: "all",
    ownerFilter: "",
    total: 0,
    hasMore: false,
    selectedClaim: null,
    showTemplateSelector: false,
    showDetailsModal: false,
    showEnhancedSinkViewer: false,
    sinkViewerClaim: null,
    showJSONViewer: false,
    jsonViewerClaim: null,
    showEditModal: false,
    editClaim: null,
    showTokenizeModal: false,
    tokenizeClaim: null,
    showOnChainStatusModal: false,
    onChainStatusClaim: null,
    aggregatedValues: {},
    loadingAggregations: {},
    onChainAggregateValues: {},
  });

  // Initialize user claims service when session is available
  useEffect(() => {
    if (session?.user?.email) {
      const service = createUserClaimsService(session.user.email);
      setUserClaimsService(service);
    }
  }, [session]);

  // Status color mapping
  const getStatusColor = (status: ClaimStatus): string => {
    switch (status) {
      case "passed":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "failed":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      case "pending":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
      case "expired":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200";
      case "suspended":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      case "under_review":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  // Load aggregated value for a single claim
  const loadAggregatedValue = useCallback(async (claim: Claim) => {
    console.log(`🔍 loadAggregatedValue called for claim ${claim.id}`, {
      hasTemplateId: !!claim.templateId,
      hasExecutionId: !!claim.executionId,
      hasSinks: !!claim.formula?.sinks,
      sinksLength: claim.formula?.sinks?.length,
      templateId: claim.templateId,
      executionId: claim.executionId,
      sinks: claim.formula?.sinks,
      aggregationFormula: claim.aggregationFormula
    });

    if (!claim.templateId || !claim.executionId || !claim.formula?.sinks || claim.formula.sinks.length === 0) {
      console.warn(`⚠️ Skipping aggregation for claim ${claim.id} - missing required data`);
      return; // Can't compute aggregation without these
    }

    // Mark as loading
    setState(prev => ({
      ...prev,
      loadingAggregations: { ...prev.loadingAggregations, [claim.id]: true }
    }));

    try {
      // Get the first sink (for now, could aggregate multiple sinks later)
      const primarySink = claim.formula.sinks[0];

      // Determine formula to use
      let formulaType = 'latest';
      let customExpression: string | undefined;

      if (claim.aggregationFormula) {
        formulaType = claim.aggregationFormula.type;
        customExpression = claim.aggregationFormula.customExpression;
      }

      console.log(`📊 Loading aggregation for claim ${claim.id}: sink=${primarySink}, formula=${formulaType}`);

      const aggregationData = await engineAPIService.getSinkAggregation(
        claim.templateId,
        claim.executionId,
        primarySink,
        formulaType,
        customExpression
      );

      console.log(`✅ Loaded aggregation for claim ${claim.id}:`, {
        aggregatedValue: aggregationData.aggregatedValue,
        totalEvents: aggregationData.totalEvents,
        fullResponse: aggregationData
      });

      setState(prev => ({
        ...prev,
        aggregatedValues: { ...prev.aggregatedValues, [claim.id]: aggregationData.aggregatedValue },
        loadingAggregations: { ...prev.loadingAggregations, [claim.id]: false }
      }));

      console.log(`✅ State updated for claim ${claim.id}:`, aggregationData.aggregatedValue);
    } catch (error) {
      console.error(`❌ Failed to load aggregation for claim ${claim.id}:`, error);
      setState(prev => ({
        ...prev,
        aggregatedValues: { ...prev.aggregatedValues, [claim.id]: 'Error' },
        loadingAggregations: { ...prev.loadingAggregations, [claim.id]: false }
      }));
    }
  }, []);

  // Load on-chain aggregate value for tokenized claims
  const loadOnChainAggregateValue = useCallback(async (claim: Claim) => {
    const tokenId = claim.tokenization?.onChain?.tokenId;
    if (!tokenId) return;

    try {
      const onChainState = await getClaimState(BigInt(tokenId));
      const onChainAggValue = onChainState.aggregateValue;

      setState(prev => ({
        ...prev,
        onChainAggregateValues: { ...prev.onChainAggregateValues, [claim.id]: onChainAggValue }
      }));

      console.log(`✅ Loaded on-chain aggregate for claim ${claim.id}:`, onChainAggValue);
    } catch (error) {
      console.error(`❌ Failed to load on-chain aggregate for claim ${claim.id}:`, error);
    }
  }, []);

  // Load claims with current filters
  const loadClaims = useCallback(async () => {
    if (!userClaimsService) {
      return; // Wait for service to be initialized
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const criteria: ClaimSearchCriteria = {
        query: state.searchQuery.trim() || undefined,
        status: state.statusFilter !== "all" ? [state.statusFilter] : undefined,
        formulaType: state.formulaTypeFilter !== "all" ? [state.formulaTypeFilter] : undefined,
        owner: state.ownerFilter.trim() ? [state.ownerFilter.trim()] : undefined,
        sortBy: "lastUpdated",
        sortOrder: "desc",
        limit: 50,
      };

      const result = await userClaimsService.searchClaims(criteria);

      setState(prev => ({
        ...prev,
        claims: result.claims,
        total: result.total,
        hasMore: result.hasMore,
        isLoading: false,
      }));

      // Load aggregated values for all claims with template/execution info
      for (const claim of result.claims) {
        if (claim.templateId && claim.executionId && claim.formula?.sinks && claim.formula.sinks.length > 0) {
          loadAggregatedValue(claim);
        }
        // Load on-chain aggregate value for tokenized claims
        if (claim.tokenization?.onChain?.tokenId) {
          loadOnChainAggregateValue(claim);
        }
      }
    } catch (error) {
      console.error("Error loading claims:", error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load claims",
        isLoading: false,
      }));
    }
  }, [state.searchQuery, state.statusFilter, state.formulaTypeFilter, state.ownerFilter, userClaimsService, loadAggregatedValue]);

  // Load claims on mount and when filters change
  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  // Search input handler with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setState(prev => ({ ...prev, searchQuery: query }));
  };

  // Filter handlers
  const handleStatusFilter = (value: string) => {
    setState(prev => ({ ...prev, statusFilter: value as ClaimStatus | "all" }));
  };

  const handleFormulaTypeFilter = (value: string) => {
    setState(prev => ({ ...prev, formulaTypeFilter: value as ClaimFormulaType | "all" }));
  };

  const handleOwnerFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, ownerFilter: e.target.value }));
  };

  // Action handlers
  const handleViewClaim = (claim: Claim) => {
    setState(prev => ({
      ...prev,
      selectedClaim: claim,
      showDetailsModal: true,
    }));
  };

  const handleEditClaim = (claim: Claim) => {
    setState(prev => ({
      ...prev,
      showEditModal: true,
      editClaim: claim,
    }));
  };

  const handleTokenizeClaim = (claim: Claim) => {
    setState(prev => ({
      ...prev,
      showTokenizeModal: true,
      tokenizeClaim: claim,
    }));
  };

  const handleClaimTokenized = async (updatedClaim: Claim) => {
    if (!userClaimsService) return;

    try {
      // Don't save to Firestore if txHash is still pending
      const txHash = updatedClaim.tokenization?.onChain?.txHash;
      if (txHash === 'pending') {
        console.log('⏳ TxHash pending - will update when available');
        return;
      }

      // Update claim in Firestore with on-chain data
      await userClaimsService.updateClaim(updatedClaim.id, {
        tokenization: updatedClaim.tokenization,
      });

      // Reload claims to show updated tokenization status
      await loadClaims();
      console.log('✅ Claim tokenized successfully on-chain');
    } catch (error) {
      console.error('❌ Error saving tokenization data:', error);
    }
  };

  const handleUpdateClaimOnChain = async (claim: Claim) => {
    if (!userClaimsService || !claim.tokenization?.onChain) return;

    try {
      console.log('🔄 Updating claim on-chain with new events...');

      // Get current aggregation data
      const primarySink = claim.formula?.sinks?.[0];
      if (!primarySink || !claim.templateId || !claim.executionId) {
        throw new Error("Missing required claim data");
      }

      const formulaType = claim.aggregationFormula?.type || 'latest';

      const aggregationData = await engineAPIService.getSinkAggregation(
        claim.templateId,
        claim.executionId,
        primarySink,
        formulaType,
        claim.aggregationFormula?.customExpression
      );

      const localLedgerCount = aggregationData.totalEvents || 0;
      const localSinkCount = aggregationData.events?.length || 0;
      const onChainLedgerCount = claim.tokenization.onChain.onChainLedgerEventCount;
      const onChainSinkCount = claim.tokenization.onChain.onChainSinkEventCount;

      // Get only the new events (events after on-chain count)
      const allEvents = aggregationData.events || [];
      const newSinkEvents = allEvents.slice(onChainSinkCount);
      const newLedgerEvents = newSinkEvents; // Placeholder - would get from full execution

      if (newSinkEvents.length === 0) {
        console.log('ℹ️ No new events to append');
        return;
      }

      // Append events on-chain
      const { txHash } = await appendEventsOnChain({
        tokenId: BigInt(claim.tokenization.onChain.tokenId),
        newLedgerEvents,
        newSinkEvents,
        newAggregateValue: aggregationData.aggregatedValue,
      });

      // Update claim with new on-chain data
      const updatedOnChain = {
        ...claim.tokenization.onChain,
        onChainLedgerEventCount: localLedgerCount,
        onChainSinkEventCount: localSinkCount,
        lastOnChainUpdate: new Date(),
        lastSyncCheck: new Date(),
        txHash, // Update with latest transaction
      };

      await userClaimsService.updateClaim(claim.id, {
        tokenization: {
          ...claim.tokenization,
          onChain: updatedOnChain,
        },
      });

      // Reload claims to show updated status
      await loadClaims();
      console.log(`✅ Claim updated on-chain! ${newSinkEvents.length} new events appended`);
    } catch (error) {
      console.error('❌ Error updating claim on-chain:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to update claim on blockchain',
      }));
    }
  };

  const handleSaveClaim = async (updatedClaimData: Partial<Claim>) => {
    if (!userClaimsService || !state.editClaim) return;

    try {
      await userClaimsService.updateClaim(state.editClaim.id, updatedClaimData);
      await loadClaims(); // Reload the list to show updated data
      console.log('✅ Claim updated successfully');
    } catch (error) {
      console.error('❌ Error updating claim:', error);
      throw error; // Re-throw to let the modal handle the error display
    }
  };

  const handleDeleteClaim = async (claim: Claim) => {
    if (window.confirm(`Are you sure you want to delete claim "${claim.title}"?`)) {
      try {
        await userClaimsService.deleteClaim(claim.id);
        await loadClaims(); // Reload the list
      } catch (error) {
        console.error("Error deleting claim:", error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to delete claim",
        }));
      }
    }
  };

  const handleCreateClaim = () => {
    setState(prev => ({ ...prev, showTemplateSelector: true }));
  };

  const handleCloseModals = () => {
    setState(prev => ({
      ...prev,
      selectedClaim: null,
      showTemplateSelector: false,
      showDetailsModal: false,
      showEnhancedSinkViewer: false,
      sinkViewerClaim: null,
      showJSONViewer: false,
      jsonViewerClaim: null,
      showEditModal: false,
      editClaim: null,
    }));
  };

  const handleClaimCreated = () => {
    handleCloseModals();
    loadClaims(); // Reload the list
  };

  const handleTemplateSelected = async (templateData: Partial<Claim>) => {
    try {
      if (!userClaimsService) return;

      // Add current user as owner if not set
      const claimData = {
        ...templateData,
        owner: templateData.owner || session?.user?.email || "unknown",
        createdBy: session?.user?.email || "unknown"
      };

      await userClaimsService.createClaim(claimData);
      handleClaimCreated();
    } catch (error) {
      console.error('Error creating claim from template:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to create claim from template'
      }));
    }
  };

  const handleViewJSON = (claim: Claim) => {
    setState(prev => ({
      ...prev,
      showJSONViewer: true,
      jsonViewerClaim: claim,
    }));
  };

  const handleViewSinkState = (claim: Claim) => {
    if (!claim.templateId || !claim.executionId) {
      alert('This claim is missing template or execution information needed for sink monitoring.');
      return;
    }

    setState(prev => ({
      ...prev,
      showEnhancedSinkViewer: true,
      sinkViewerClaim: claim
    }));
  };

  // Format date for display
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A";

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return "Invalid Date";

      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj);
    } catch (error) {
      return "Invalid Date";
    }
  };

  // Get unique owners for filter dropdown
  const uniqueOwners = [...new Set(state.claims.map(claim => claim.owner).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Registry</h1>
          <p className="text-muted-foreground">
            Manage and track compliance claims across your workflows
          </p>
        </div>
        <Button onClick={handleCreateClaim} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Claim
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search claims..."
                value={state.searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={state.statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>

            {/* Formula Type Filter */}
            <Select value={state.formulaTypeFilter} onValueChange={handleFormulaTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by formula type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formula Types</SelectItem>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
                <SelectItem value="THRESHOLD">THRESHOLD</SelectItem>
                <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                <SelectItem value="WEIGHTED">WEIGHTED</SelectItem>
                <SelectItem value="TEMPORAL">TEMPORAL</SelectItem>
                <SelectItem value="MAJORITY">MAJORITY</SelectItem>
              </SelectContent>
            </Select>

            {/* Owner Filter */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Filter by owner..."
                value={state.ownerFilter}
                onChange={handleOwnerFilter}
                className="pl-10"
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {state.claims.length} of {state.total} claims
            </span>
            {(state.searchQuery || state.statusFilter !== "all" || state.formulaTypeFilter !== "all" || state.ownerFilter) && (
              <span className="flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Filters active
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Claims List
            {state.isLoading && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{state.error}</p>
            </div>
          )}

          {state.claims.length === 0 && !state.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {state.searchQuery || state.statusFilter !== "all" || state.formulaTypeFilter !== "all" || state.ownerFilter
                ? "No claims match your filters"
                : "No claims found. Create your first claim to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Sinks</TableHead>
                  <TableHead>Aggregated Value</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Tokenization</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.claims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{claim.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{claim.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {claim.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {claim.formula?.sinks && claim.formula.sinks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {claim.formula.sinks.map((sinkId, index) => (
                            <Badge key={index} variant="outline" className="text-xs font-mono">
                              {sinkId}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const aggregatedValue = state.aggregatedValues[claim.id];
                        const isLoading = state.loadingAggregations[claim.id];

                        if (isLoading) {
                          return (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                              <span className="text-xs text-muted-foreground">Loading...</span>
                            </div>
                          );
                        }

                        if (aggregatedValue === undefined || aggregatedValue === null) {
                          return <span className="text-muted-foreground text-sm">-</span>;
                        }

                        if (aggregatedValue === 'Error') {
                          return <Badge variant="destructive" className="text-xs">Error</Badge>;
                        }

                        // Check sync status if claim is tokenized
                        const isTokenized = !!claim.tokenization?.onChain;
                        // Use real on-chain value from blockchain, not cached database value
                        const onChainAggValue = state.onChainAggregateValues[claim.id];
                        const localAggValue = typeof aggregatedValue === 'object'
                          ? JSON.stringify(aggregatedValue)
                          : String(aggregatedValue);
                        const isSynced = isTokenized && onChainAggValue === localAggValue;
                        const isOutOfSync = isTokenized && onChainAggValue && onChainAggValue !== localAggValue;

                        // Debug logging for sync status
                        if (isTokenized && claim.id === 'claim-1763223933843-y4mrll') {
                          console.log('🔍 Table Sync Check for Claim 2:', {
                            claimId: claim.id,
                            onChainAggValue,
                            localAggValue,
                            isSynced,
                            isOutOfSync,
                            match: onChainAggValue === localAggValue,
                            onChainType: typeof onChainAggValue,
                            localType: typeof localAggValue,
                          });
                        }

                        // Handle objects - stringify them properly
                        if (typeof aggregatedValue === 'object') {
                          const jsonStr = JSON.stringify(aggregatedValue, null, 2);
                          const preview = jsonStr.slice(0, 30);
                          return (
                            <div className="flex items-center gap-1">
                              {isTokenized && isSynced && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              {isTokenized && isOutOfSync && (
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                              )}
                              <span className="font-mono text-xs" title={jsonStr}>
                                {preview}{jsonStr.length > 30 ? '...' : ''}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  // Show JSON in modal with the aggregated value
                                  const claimWithValue = { ...claim, aggregatedValue };
                                  setState(prev => ({
                                    ...prev,
                                    showJSONViewer: true,
                                    jsonViewerClaim: claimWithValue
                                  }));
                                }}
                              >
                                <FileText className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        }

                        // Handle primitives
                        return (
                          <div className="flex items-center gap-1">
                            {isTokenized && isSynced && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                            {isTokenized && isOutOfSync && (
                              <AlertCircle className="w-4 h-4 text-yellow-600" />
                            )}
                            <span className="font-mono text-sm font-semibold text-blue-600">
                              {String(aggregatedValue)}
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{claim.formula.type}</Badge>
                    </TableCell>
                    <TableCell>{claim.owner || "Unassigned"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(claim.lastUpdated)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Check if claim is tokenized
                        if (!claim.tokenization?.onChain) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTokenizeClaim(claim)}
                              className="text-xs"
                            >
                              <Coins className="w-3 h-3 mr-1" />
                              Tokenize
                            </Button>
                          );
                        }

                        // Claim is tokenized - show status badge that opens modal
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setState(prev => ({
                              ...prev,
                              showOnChainStatusModal: true,
                              onChainStatusClaim: claim
                            }))}
                            className="text-xs"
                          >
                            <Coins className="w-3 h-3 mr-1" />
                            View Status
                          </Button>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewClaim(claim)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClaim(claim)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewJSON(claim)}
                          className="h-8 w-8 p-0"
                          title="View JSON file"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {claim.templateId && claim.executionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSinkState(claim)}
                            className="h-8 w-8 p-0"
                            title="View sink states and token counts"
                          >
                            <Activity className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClaim(claim)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {state.showDetailsModal && state.selectedClaim && userClaimsService && (
        <ClaimDetailsModal
          claim={state.selectedClaim}
          onClose={handleCloseModals}
          claimsService={userClaimsService}
        />
      )}

      <SimpleClaimCreator
        open={state.showTemplateSelector}
        onOpenChange={(open) => setState(prev => ({ ...prev, showTemplateSelector: open }))}
        onClaimCreated={handleTemplateSelected}
      />

      {state.showEnhancedSinkViewer && state.sinkViewerClaim && (
        <CompactSinkViewer
          claim={state.sinkViewerClaim}
          onClose={() => setState(prev => ({
            ...prev,
            showEnhancedSinkViewer: false,
            sinkViewerClaim: null
          }))}
        />
      )}

      <JSONViewerModal
        claim={state.jsonViewerClaim}
        onClose={() => setState(prev => ({
          ...prev,
          showJSONViewer: false,
          jsonViewerClaim: null
        }))}
      />

      {state.showEditModal && state.editClaim && (
        <ClaimEditModal
          claim={state.editClaim}
          isOpen={state.showEditModal}
          onClose={() => setState(prev => ({
            ...prev,
            showEditModal: false,
            editClaim: null
          }))}
          onSave={handleSaveClaim}
        />
      )}

      <TokenizeClaimModal
        claim={state.tokenizeClaim}
        isOpen={state.showTokenizeModal}
        onClose={() => setState(prev => ({
          ...prev,
          showTokenizeModal: false,
          tokenizeClaim: null
        }))}
        onTokenized={handleClaimTokenized}
      />

      <TokenizationStatusModal
        claim={state.onChainStatusClaim}
        isOpen={state.showOnChainStatusModal}
        onClose={() => setState(prev => ({
          ...prev,
          showOnChainStatusModal: false,
          onChainStatusClaim: null
        }))}
        localAggregatedValue={state.onChainStatusClaim ? state.aggregatedValues[state.onChainStatusClaim.id] : undefined}
        onSyncComplete={() => {
          // Reload claims after sync to update the UI
          loadClaims();
        }}
      />
    </div>
  );
}