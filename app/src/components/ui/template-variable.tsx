"use client";

import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Variable } from "lucide-react";

interface TemplateVariableProps {
  text: string;
  variables: Record<string, any>;
}

export const TemplateVariable = ({ text, variables }: TemplateVariableProps) => {
  // Split text into parts, preserving template variables
  const renderText = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith("{{") && part.endsWith("}}")) {
        const path = part.slice(2, -2).trim();
        return <TemplateValue key={index} path={path} variables={variables} />;
      }
      return part;
    });
  };

  return <span>{renderText(text)}</span>;
};

interface TemplateValueProps {
  path: string;
  variables: Record<string, any>;
}

const TemplateValue = ({ path, variables }: TemplateValueProps) => {
  const [showValue, setShowValue] = useState(false);

  const resolveValue = (path: string, obj: Record<string, any>): string => {
    const parts = path.split(".");
    let value = obj;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return path;
    }
    return typeof value === "string" ? value : path;
  };

  const value = resolveValue(path, variables);
  const displayText = showValue ? value : `{{${path}}}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="px-1 bg-primary/10 text-primary rounded hover:bg-primary/20 cursor-help inline-flex items-center gap-1"
            onMouseEnter={() => setShowValue(true)}
            onMouseLeave={() => setShowValue(false)}
          >
            {displayText}
            <Variable className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{showValue ? `Template: {{${path}}}` : `Value: ${value}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
