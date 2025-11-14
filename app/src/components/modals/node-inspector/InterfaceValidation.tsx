import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSimulationStore } from "@/stores/simulationStore";

interface InterfaceValidationProps {
  nodeConfig: any;
}

export const InterfaceValidation: React.FC<InterfaceValidationProps> = ({ nodeConfig }) => {
  const scenario = useSimulationStore(state => state.scenario);
  const [validationResult, setValidationResult] = useState<any>(null);

  useEffect(() => {
    if (scenario && nodeConfig) {
      try {
        // Skip validation for now since InterfaceCompatibilityValidator is not available
        setValidationResult(null);
      } catch (error) {
        console.warn('Interface validation error:', error);
        setValidationResult(null);
      }
    }
  }, [nodeConfig, scenario]);

  if (!validationResult) {
    return null;
  }

  const hasErrors = validationResult.errors && validationResult.errors.length > 0;
  const hasWarnings = validationResult.warnings && validationResult.warnings.length > 0;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-slate-700 flex items-center gap-2">
        {validationResult.valid ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        )}
        Interface Validation
        <Badge
          variant="outline"
          className={`text-xs ${
            validationResult.valid
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {validationResult.valid ? 'Valid' : 'Invalid'}
        </Badge>
      </h4>

      {hasErrors && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Errors ({validationResult.errors.length})
          </div>
          {validationResult.errors.map((error: string, index: number) => (
            <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
              {error}
            </div>
          ))}
        </div>
      )}

      {hasWarnings && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-orange-700 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Warnings ({validationResult.warnings.length})
          </div>
          {validationResult.warnings.map((warning: string, index: number) => (
            <div key={index} className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
              {warning}
            </div>
          ))}
        </div>
      )}

      {!hasErrors && !hasWarnings && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100 flex items-center gap-2">
          <CheckCircle className="h-3 w-3" />
          All interface contracts are valid
        </div>
      )}
    </div>
  );
};
