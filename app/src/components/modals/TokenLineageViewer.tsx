"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  GitBranch,
  GitMerge,
  Activity,
  Hash,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Circle,
  Square,
  Triangle
} from "lucide-react";
import { TokenLineageTracker, type TokenLineageTree, type TokenLineageNode } from "@/lib/simulation/tokenLineage";
import type { Token } from "@/lib/simulation/types";

interface TokenLineageViewerProps {
  token: Token;
  onTokenClick?: (tokenId: string) => void;
}

const LineageNodeDisplay: React.FC<{
  node: TokenLineageNode;
  depth: number;
  onTokenClick?: (tokenId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasChildren: boolean;
}> = ({ node, depth, onTokenClick, isExpanded, onToggleExpand, hasChildren }) => {
  const getLineageIcon = () => {
    switch (node.lineageType) {
      case 'source': return <Circle className="w-3 h-3 text-green-500" />;
      case 'transformed': return <Square className="w-3 h-3 text-blue-500" />;
      case 'aggregated': return <Triangle className="w-3 h-3 text-purple-500" />;
      case 'split': return <GitBranch className="w-3 h-3 text-orange-500" />;
      default: return <Circle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getLineageBadgeVariant = () => {
    switch (node.lineageType) {
      case 'source': return 'default';
      case 'transformed': return 'secondary';
      case 'aggregated': return 'outline';
      case 'split': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div
      className="group hover:bg-muted/50 rounded-md p-2 transition-colors cursor-pointer"
      style={{ marginLeft: `${depth * 24}px` }}
    >
      <div className="flex items-start gap-2">
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}

        {getLineageIcon()}

        <div
          className="flex-1 min-w-0"
          onClick={() => onTokenClick?.(node.tokenId)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-primary hover:underline">
              {node.tokenId}
            </span>
            <Badge variant={getLineageBadgeVariant() as any} className="text-xs px-1 py-0">
              {node.lineageType}
            </Badge>
            <span className="text-xs text-muted-foreground">
              @ {node.timestamp}s
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {node.nodeName}
            </span>
            <span className="text-xs font-medium">
              value: {JSON.stringify(node.value)}
            </span>
          </div>

          {node.action && (
            <div className="text-xs text-muted-foreground mt-1">
              Action: {node.action}
            </div>
          )}

          {node.parentTokens.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              From: {node.parentTokens.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TokenLineageViewer: React.FC<TokenLineageViewerProps> = ({ token, onTokenClick }) => {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set([token.id]));

  const lineage = useMemo(() => {
    return TokenLineageTracker.getTokenLineage(token.id);
  }, [token.id]);

  const toggleExpand = (tokenId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(tokenId)) {
        next.delete(tokenId);
      } else {
        next.add(tokenId);
      }
      return next;
    });
  };

  if (!lineage) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No lineage information available for this token.
      </div>
    );
  }

  const renderLineageTree = (nodes: TokenLineageNode[], title: string, icon: React.ReactNode) => (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="outline" className="ml-auto">
            {nodes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-[300px]">
          {nodes.length > 0 ? (
            <div className="space-y-1">
              {nodes.map((node, idx) => (
                <LineageNodeDisplay
                  key={`${node.tokenId}-${idx}`}
                  node={node}
                  depth={0}
                  onTokenClick={onTokenClick}
                  isExpanded={expandedNodes.has(node.tokenId)}
                  onToggleExpand={() => toggleExpand(node.tokenId)}
                  hasChildren={node.childTokens.length > 0}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground p-2">
              No {title.toLowerCase()} found
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderFullPath = () => {
    const path = lineage.fullPath;
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Complete Journey
            <Badge variant="outline" className="ml-auto">
              {path.length} steps
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ScrollArea className="h-[400px]">
            <div className="relative">
              {/* Connection line */}
              <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-border" />

              {path.map((node, idx) => (
                <div key={`${node.tokenId}-${idx}`} className="relative flex items-start gap-4 mb-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-1">
                    <div className={`w-3 h-3 rounded-full border-2 border-background ${
                      node.tokenId === token.id ? 'bg-primary' : 'bg-muted-foreground'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onTokenClick?.(node.tokenId)}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {node.tokenId}
                      </button>
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {node.lineageType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {node.timestamp}s
                      </span>
                    </div>

                    <div className="text-xs">
                      <span className="text-muted-foreground">at</span>{' '}
                      <span className="font-medium">{node.nodeName}</span>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1">
                      {node.action} → value: {JSON.stringify(node.value)}
                    </div>

                    {idx < path.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-muted-foreground mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const currentNode = lineage.fullPath.find(n => n.tokenId === token.id);

  return (
    <div className="space-y-4">
      {/* Current Token Summary */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Token Lineage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Token ID</div>
              <div className="font-mono text-sm font-medium">{token.id}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              <Badge variant="outline">{currentNode?.lineageType || 'unknown'}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Depth</div>
              <div className="text-sm font-medium flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {currentNode?.depth || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Relations</div>
              <div className="text-sm">
                <span className="text-green-600">{lineage.ancestors.length}</span> ↑{' '}
                <span className="text-blue-600">{lineage.descendants.length}</span> ↓
              </div>
            </div>
          </div>

          {/* Lineage Chain */}
          <div className="mt-4 p-2 bg-muted/30 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Lineage Chain:</div>
            <div className="font-mono text-xs break-all">
              {TokenLineageTracker.getLineageChain(token.id)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Views */}
      <Tabs defaultValue="journey" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="ancestors">Ancestors</TabsTrigger>
          <TabsTrigger value="descendants">Descendants</TabsTrigger>
          <TabsTrigger value="siblings">Siblings</TabsTrigger>
        </TabsList>

        <TabsContent value="journey" className="mt-4">
          {renderFullPath()}
        </TabsContent>

        <TabsContent value="ancestors" className="mt-4">
          {renderLineageTree(lineage.ancestors, "Ancestors", <GitMerge className="w-4 h-4 rotate-180" />)}
        </TabsContent>

        <TabsContent value="descendants" className="mt-4">
          {renderLineageTree(lineage.descendants, "Descendants", <GitBranch className="w-4 h-4" />)}
        </TabsContent>

        <TabsContent value="siblings" className="mt-4">
          {renderLineageTree(lineage.siblings, "Siblings", <Hash className="w-4 h-4" />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TokenLineageViewer;