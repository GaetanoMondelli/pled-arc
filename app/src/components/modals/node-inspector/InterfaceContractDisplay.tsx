import React from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

/**
 * InterfaceContractDisplay - Displays interface contract details with expand/collapse
 */
export const InterfaceContractDisplay: React.FC<{
  contract: any;
  direction: 'input' | 'output';
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ contract, direction, isExpanded, onToggle }) => {
  if (!contract) return null;

  const bgColor = direction === 'input' ? 'bg-green-50' : 'bg-blue-50';
  const borderColor = direction === 'input' ? 'border-green-200' : 'border-blue-200';
  const textColor = direction === 'input' ? 'text-green-700' : 'text-blue-700';
  const badgeColor = direction === 'input' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className={`border rounded-lg p-3 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${badgeColor} border-0`}>
            {contract.type}
          </Badge>
          {contract.description && (
            <span className="text-xs text-slate-600 truncate max-w-48" title={contract.description}>
              {contract.description}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`p-1 rounded hover:bg-white/50 ${textColor}`}
        >
          {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {contract.requiredFields && contract.requiredFields.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">Required Fields:</div>
              <div className="flex flex-wrap gap-1">
                {contract.requiredFields.map((field: string, index: number) => (
                  <code key={index} className="text-xs bg-white/60 px-1.5 py-0.5 rounded border">
                    {field}
                  </code>
                ))}
              </div>
            </div>
          )}

          {contract.validation && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">Validation:</div>
              <code className="text-xs bg-white/60 px-2 py-1 rounded border block">
                {contract.validation}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
