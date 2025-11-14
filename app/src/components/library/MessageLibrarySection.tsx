"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Info,
  ChevronRight,
  Eye,
  Code2,
  Database,
  CheckCircle,
  Calculator,
  DollarSign,
  Activity
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageInterfaces, type MessageInterface } from "@/lib/simulation/message-interfaces";

interface MessageLibrarySectionProps {
  className?: string;
}

const MessageCategoryCard: React.FC<{
  category: "basic" | "aggregation" | "validation" | "transformation" | "domain-specific";
  interfaces: MessageInterface[];
  onShowDetails: (messageInterface: MessageInterface) => void;
}> = ({ category, interfaces, onShowDetails }) => {
  const categoryInfo = {
    basic: {
      label: "Basic Messages",
      icon: <MessageSquare className="h-4 w-4" />,
      color: "text-slate-600",
      bgColor: "bg-slate-100 text-slate-700 border-slate-200"
    },
    aggregation: {
      label: "Aggregation",
      icon: <Calculator className="h-4 w-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-100 text-blue-700 border-blue-200"
    },
    validation: {
      label: "Validation",
      icon: <CheckCircle className="h-4 w-4" />,
      color: "text-green-600",
      bgColor: "bg-green-100 text-green-700 border-green-200"
    },
    transformation: {
      label: "Transformation",
      icon: <Code2 className="h-4 w-4" />,
      color: "text-purple-600",
      bgColor: "bg-purple-100 text-purple-700 border-purple-200"
    },
    "domain-specific": {
      label: "Domain Specific",
      icon: <DollarSign className="h-4 w-4" />,
      color: "text-orange-600",
      bgColor: "bg-orange-100 text-orange-700 border-orange-200"
    }
  }[category];

  const categoryInterfaces = interfaces.filter(i => i.category === category);

  if (categoryInterfaces.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className={categoryInfo.color}>
          {categoryInfo.icon}
        </div>
        <h3 className="font-semibold text-xs text-slate-800">{categoryInfo.label}</h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
          {categoryInterfaces.length}
        </Badge>
      </div>

      <div className="space-y-1">
        {categoryInterfaces.map((messageInterface) => (
          <MessageInterfaceCard
            key={messageInterface.name}
            messageInterface={messageInterface}
            categoryBgColor={categoryInfo.bgColor}
            onShowDetails={onShowDetails}
          />
        ))}
      </div>
    </div>
  );
};

const MessageInterfaceCard: React.FC<{
  messageInterface: MessageInterface;
  categoryBgColor: string;
  onShowDetails: (messageInterface: MessageInterface) => void;
}> = ({ messageInterface, categoryBgColor, onShowDetails }) => {
  return (
    <div className="group relative border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-all bg-white hover:border-slate-300">
      {/* Info button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onShowDetails(messageInterface);
        }}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Eye className="h-3 w-3 text-slate-500" />
      </button>

      {/* Icon */}
      <div className={cn(
        "w-6 h-6 rounded flex items-center justify-center mb-2 flex-shrink-0",
        categoryBgColor
      )}>
        <MessageSquare className="h-3 w-3" />
      </div>

      {/* Name */}
      <h4 className="font-medium text-xs text-slate-800 leading-tight mb-1">
        {messageInterface.name}
      </h4>

      {/* Description */}
      <p className="text-[10px] text-slate-600 leading-tight line-clamp-2">
        {messageInterface.description}
      </p>

      {/* Category badge */}
      <div className="mt-2">
        <Badge variant="outline" className="text-[9px] px-1 py-0">
          {messageInterface.category}
        </Badge>
      </div>
    </div>
  );
};

const MessageSchemaViewer: React.FC<{
  messageInterface: MessageInterface | null;
  onClose: () => void;
}> = ({ messageInterface, onClose }) => {
  if (!messageInterface) return null;

  // Generate sample data based on schema
  const generateSampleData = (messageInterface: MessageInterface) => {
    try {
      const baseMessage = {
        id: "msg_12345",
        timestamp: Date.now(),
        sourceNodeId: "node_1",
        messageType: messageInterface.name,
        ...messageInterface.defaultFields
      };
      return JSON.stringify(baseMessage, null, 2);
    } catch (error) {
      return "// Error generating sample data";
    }
  };

  const sampleData = generateSampleData(messageInterface);

  return (
    <Dialog open={!!messageInterface} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 border-blue-200 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{messageInterface.name} Message</DialogTitle>
              <DialogDescription>
                <Badge variant="outline" className="text-xs mt-1">
                  {messageInterface.category}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Description</h4>
            <p className="text-sm text-slate-600">
              {messageInterface.description}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Sample Message Structure</h4>
            <pre className="text-xs bg-slate-50 p-3 rounded border font-mono overflow-x-auto max-h-48 text-slate-700">
              {sampleData}
            </pre>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Usage Examples</h4>
            <div className="space-y-2">
              {messageInterface.category === 'aggregation' && (
                <div className="p-2 bg-blue-50 rounded border-l-4 border-blue-200">
                  <p className="text-xs text-blue-800 font-medium">Queue Aggregation Formula:</p>
                  <code className="text-xs text-blue-700">avg(input.data.value)</code>
                </div>
              )}
              {messageInterface.category === 'validation' && (
                <div className="p-2 bg-green-50 rounded border-l-4 border-green-200">
                  <p className="text-xs text-green-800 font-medium">Validation Rule Example:</p>
                  <code className="text-xs text-green-700">input.data.value &gt; 0 &amp;&amp; input.data.value &lt; 100</code>
                </div>
              )}
              {messageInterface.category === 'transformation' && (
                <div className="p-2 bg-purple-50 rounded border-l-4 border-purple-200">
                  <p className="text-xs text-purple-800 font-medium">Process Node Formula:</p>
                  <code className="text-xs text-purple-700">inputA.data.transformedValue * 2</code>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Compatible Node Types</h4>
            <div className="flex flex-wrap gap-1">
              {messageInterface.category === 'basic' && (
                <>
                  <Badge variant="outline" className="text-xs">DataSource</Badge>
                  <Badge variant="outline" className="text-xs">All Nodes</Badge>
                </>
              )}
              {messageInterface.category === 'aggregation' && (
                <>
                  <Badge variant="outline" className="text-xs">Queue</Badge>
                  <Badge variant="outline" className="text-xs">ProcessNode</Badge>
                </>
              )}
              {messageInterface.category === 'validation' && (
                <>
                  <Badge variant="outline" className="text-xs">Validation</Badge>
                  <Badge variant="outline" className="text-xs">Sink</Badge>
                </>
              )}
              {messageInterface.category === 'transformation' && (
                <>
                  <Badge variant="outline" className="text-xs">ProcessNode</Badge>
                  <Badge variant="outline" className="text-xs">Sink</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function MessageLibrarySection({ className }: MessageLibrarySectionProps) {
  const [detailsInterface, setDetailsInterface] = useState<MessageInterface | null>(null);

  const handleShowDetails = (messageInterface: MessageInterface) => {
    setDetailsInterface(messageInterface);
  };

  const handleCloseDetails = () => {
    setDetailsInterface(null);
  };

  const interfaces = Object.values(MessageInterfaces);
  const categories: Array<"basic" | "aggregation" | "validation" | "transformation" | "domain-specific"> =
    ["basic", "aggregation", "validation", "transformation", "domain-specific"];

  return (
    <div className={cn("flex flex-col", className)} style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-sm">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex-shrink-0">
        <div className="text-[11px] text-blue-700 text-center">
          <span className="font-medium">Message Interfaces</span> for typing
        </div>
      </div>

      {/* Message Library */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollArea className="w-full h-full">
          <div className="px-3 py-3 space-y-1">
            {categories.map(category => (
              <MessageCategoryCard
                key={category}
                category={category}
                interfaces={interfaces}
                onShowDetails={handleShowDetails}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
          <Activity className="h-3 w-3" />
          <span>{interfaces.length} message types available</span>
        </div>
      </div>

      {/* Message Details Modal */}
      <MessageSchemaViewer
        messageInterface={detailsInterface}
        onClose={handleCloseDetails}
      />
    </div>
  );
}