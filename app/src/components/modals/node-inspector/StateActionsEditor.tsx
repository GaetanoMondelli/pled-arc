import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StateActionsEditorProps {
  stateName: string;
  stateIndex: number;
  actions: any[];
  nodeConfig: any;
  onActionsUpdate: (newActions: any[]) => void;
  onAutoGenerateOutput?: (outputName: string) => void;
}

export const StateActionsEditor: React.FC<StateActionsEditorProps> = ({ 
  stateName, 
  stateIndex, 
  actions, 
  nodeConfig, 
  onActionsUpdate, 
  onAutoGenerateOutput 
}) => {
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [newActionType, setNewActionType] = useState<'emit' | 'log'>('emit');
  const [newActionFormula, setNewActionFormula] = useState('');
  const [newActionTarget, setNewActionTarget] = useState('');
  const [newActionLogValue, setNewActionLogValue] = useState('');

  // Get available output destinations
  const availableOutputs = nodeConfig.outputs || [];

  // Get existing output names
  const existingOutputNames = availableOutputs.map((o: any) => o.name);

  const handleAddAction = () => {
    if (newActionType === 'emit') {
      if (!newActionFormula || !newActionTarget) {
        return;
      }

      // Auto-generate output if it doesn't exist
      if (!existingOutputNames.includes(newActionTarget)) {
        onAutoGenerateOutput?.(newActionTarget);
      }

      const newAction = {
        action: 'emit',
        target: newActionTarget,
        formula: newActionFormula
      };
      onActionsUpdate([...actions, newAction]);
    } else if (newActionType === 'log') {
      if (!newActionLogValue) {
        return;
      }
      const newAction = {
        action: 'log',
        value: newActionLogValue
      };
      onActionsUpdate([...actions, newAction]);
    }

    // Reset form
    setNewActionFormula('');
    setNewActionTarget('');
    setNewActionLogValue('');
    setIsAddingAction(false);
  };

  const handleRemoveAction = (actionIndex: number) => {
    const updatedActions = actions.filter((_, idx) => idx !== actionIndex);
    onActionsUpdate(updatedActions);
  };

  return (
    <div className="border border-slate-200 rounded p-3 bg-slate-50">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-slate-700">{stateName}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{actions.length} action(s)</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setIsAddingAction(!isAddingAction)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Existing Actions */}
        {actions.length > 0 && (
          <div className="space-y-2">
            {actions.map((action: any, actionIndex: number) => (
              <div key={actionIndex} className="p-2 bg-white border rounded group relative">
                <button
                  onClick={() => handleRemoveAction(actionIndex)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Remove action"
                >
                  <X className="h-2.5 w-2.5" />
                </button>

                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 uppercase">{action.action}</span>
                  {action.action === 'emit' && action.target && (
                    <span className="text-xs text-slate-500">→ {action.target}</span>
                  )}
                </div>

                {action.action === 'emit' && action.formula && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-slate-600 mb-1">Formula:</div>
                    <div className="p-2 bg-slate-100 rounded text-xs font-mono text-slate-800">
                      {action.formula}
                    </div>
                  </div>
                )}

                {action.action === 'log' && action.value && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-slate-600 mb-1">Message:</div>
                    <div className="p-2 bg-slate-100 rounded text-xs text-slate-700">
                      "{action.value}"
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {actions.length === 0 && !isAddingAction && (
          <div className="text-xs text-slate-500 italic">No actions - Click + to add</div>
        )}

        {/* Add Action Form */}
        {isAddingAction && (
          <div className="mt-2 p-3 bg-white border border-blue-200 rounded space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Action Type</label>
              <div className="flex gap-2">
                <Button
                  variant={newActionType === 'emit' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setNewActionType('emit')}
                >
                  Emit Output
                </Button>
                <Button
                  variant={newActionType === 'log' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setNewActionType('log')}
                >
                  Log Message
                </Button>
              </div>
            </div>

            {newActionType === 'emit' && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Output Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Type new output name (e.g., output1, result)"
                    value={newActionTarget}
                    onChange={(e) => setNewActionTarget(e.target.value)}
                    className="h-7 text-xs"
                    autoFocus
                    list="existing-outputs"
                  />
                  <datalist id="existing-outputs">
                    {availableOutputs.map((output: any) => (
                      <option key={output.name} value={output.name} />
                    ))}
                  </datalist>
                  {newActionTarget && !existingOutputNames.includes(newActionTarget) && (
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span>✓</span> <span>Will auto-create output "{newActionTarget}"</span>
                    </div>
                  )}
                  {newActionTarget && existingOutputNames.includes(newActionTarget) && (
                    <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <span>→</span> <span>Using existing output "{newActionTarget}"</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Value Formula <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={newActionFormula}
                    onChange={(e) => setNewActionFormula(e.target.value)}
                    placeholder="e.g., inputA.data.value * 2 + inputB.data.value"
                    className="h-16 text-xs font-mono resize-none"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Use input aliases (e.g., inputA, inputB) to reference input buffers
                  </div>
                </div>
              </>
            )}

            {newActionType === 'log' && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Log Message <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newActionLogValue}
                  onChange={(e) => setNewActionLogValue(e.target.value)}
                  placeholder="Enter log message..."
                  className="h-7 text-xs"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setIsAddingAction(false);
                  setNewActionFormula('');
                  setNewActionTarget('');
                  setNewActionLogValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddAction}
                disabled={
                  (newActionType === 'emit' && (!newActionFormula || !newActionTarget)) ||
                  (newActionType === 'log' && !newActionLogValue)
                }
              >
                Add Action
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
