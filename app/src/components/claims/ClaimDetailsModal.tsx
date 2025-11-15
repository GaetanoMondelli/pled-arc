"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  User,
  FileText,
  Link as LinkIcon,
  Clock,
  Target,
  Code,
  History,
  X,
} from "lucide-react";
import { ClaimsService } from "@/lib/services/claimsService";
import {
  Claim,
  ClaimAuditEntry,
  ClaimEvaluationHistory,
} from "@/core/types/claims";

interface ClaimDetailsModalProps {
  claim: Claim;
  onClose: () => void;
  claimsService: ClaimsService;
}

export function ClaimDetailsModal({ claim, onClose, claimsService }: ClaimDetailsModalProps) {
  const [auditTrail, setAuditTrail] = useState<ClaimAuditEntry[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<ClaimEvaluationHistory | null>(null);
  const [childClaims, setChildClaims] = useState<Claim[]>([]);
  const [ancestorClaims, setAncestorClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load additional data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [audit, history, children, ancestors] = await Promise.all([
          claimsService.getAuditTrail(claim.id),
          claimsService.getEvaluationHistory(claim.id),
          claimsService.getClaimChildren(claim.id),
          claimsService.getClaimAncestors(claim.id),
        ]);

        setAuditTrail(audit);
        setEvaluationHistory(history);
        setChildClaims(children);
        setAncestorClaims(ancestors);
      } catch (error) {
        console.error("Error loading claim data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [claim.id, claimsService]);

  // Status color mapping (same as ClaimsRegistry)
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "passed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "expired":
        return "bg-orange-100 text-orange-800";
      case "suspended":
        return "bg-purple-100 text-purple-800";
      case "under_review":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                Claim {claim.id}: {claim.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusColor(claim.status)}>
                  {claim.status.replace("_", " ").toUpperCase()}
                </Badge>
                <Badge variant="outline">{claim.formula.type}</Badge>
                {claim.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
              <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="overview" className="space-y-4 mt-0">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <div className="mt-1 prose prose-sm max-w-none">
                        <ReactMarkdown>{claim.description}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Owner
                        </label>
                        <p className="mt-1">{claim.owner || "Unassigned"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created
                        </label>
                        <p className="mt-1">{formatDate(claim.createdAt)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created By</label>
                        <p className="mt-1">{claim.createdBy}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last Updated
                        </label>
                        <p className="mt-1">{formatDate(claim.lastUpdated)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Formula Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      Formula Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Type</label>
                        <div className="mt-1">
                          <Badge variant="outline">{claim.formula.type}</Badge>
                        </div>
                      </div>
                      {claim.formula.threshold && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Threshold</label>
                          <p className="mt-1">{claim.formula.threshold}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Required Sinks
                      </label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {claim.formula.sinks.map((sink, index) => (
                          <Badge key={index} variant="secondary">
                            {sink}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {claim.formula.expression && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Custom Expression</label>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-sm font-mono">
                          {claim.formula.expression}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resources and References */}
                {(claim.resources.length > 0 || claim.references.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <LinkIcon className="w-5 h-5" />
                        Resources & References
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {claim.resources.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Resources</label>
                          <ul className="mt-1 space-y-1">
                            {claim.resources.map((resource, index) => (
                              <li key={index}>
                                <a
                                  href={resource}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  {resource}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {claim.references.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">External References</label>
                          <ul className="mt-1 space-y-1">
                            {claim.references.map((reference, index) => (
                              <li key={index}>
                                <a
                                  href={reference}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  {reference}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="hierarchy" className="mt-0">
                <div className="space-y-4">
                  {/* Ancestors */}
                  {ancestorClaims.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Parent Claims</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {ancestorClaims.map((ancestor) => (
                            <div key={ancestor.id} className="flex items-center gap-2 p-2 border rounded">
                              <Badge variant="outline">{ancestor.id}</Badge>
                              <span className="font-medium">{ancestor.title}</span>
                              <Badge className={getStatusColor(ancestor.status)}>
                                {ancestor.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Children */}
                  {childClaims.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Child Claims</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {childClaims.map((child) => (
                            <div key={child.id} className="flex items-center gap-2 p-2 border rounded">
                              <Badge variant="outline">{child.id}</Badge>
                              <span className="font-medium">{child.title}</span>
                              <Badge className={getStatusColor(child.status)}>
                                {child.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {ancestorClaims.length === 0 && childClaims.length === 0 && (
                    <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        This claim has no parent or child claims.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="evaluations" className="mt-0">
                {evaluationHistory && evaluationHistory.evaluations.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Evaluation Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Total Evaluations</label>
                            <p className="text-2xl font-bold">{evaluationHistory.summary.totalEvaluations}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Pass Rate</label>
                            <p className="text-2xl font-bold text-green-600">
                              {evaluationHistory.summary.passRate.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Trend</label>
                            <p className="text-lg font-medium">
                              <Badge
                                className={
                                  evaluationHistory.summary.trendDirection === 'improving' ? getStatusColor('passed') :
                                  evaluationHistory.summary.trendDirection === 'declining' ? getStatusColor('failed') :
                                  getStatusColor('pending')
                                }
                              >
                                {evaluationHistory.summary.trendDirection}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recent Evaluations */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Evaluations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Duration (ms)</TableHead>
                              <TableHead>Evidence Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evaluationHistory.evaluations.slice(-10).reverse().map((evaluation, index) => (
                              <TableRow key={index}>
                                <TableCell>{formatDate(evaluation.evaluatedAt)}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(evaluation.status)}>
                                    {evaluation.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{evaluation.evaluationDuration}</TableCell>
                                <TableCell>{evaluation.evidence.length}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No evaluation history available for this claim.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="audit" className="mt-0">
                {auditTrail.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Audit Trail
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditTrail.reverse().map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{formatDate(entry.timestamp)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {entry.action.replace("_", " ")}
                                </Badge>
                              </TableCell>
                              <TableCell>{entry.userId}</TableCell>
                              <TableCell>
                                {entry.reason && (
                                  <p className="text-sm text-muted-foreground">{entry.reason}</p>
                                )}
                                {entry.changes && Object.keys(entry.changes).length > 0 && (
                                  <details className="text-sm">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      View changes
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                      {Object.entries(entry.changes).map(([field, change]) => (
                                        <div key={field} className="text-xs">
                                          <strong>{field}:</strong> {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No audit trail available for this claim.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}