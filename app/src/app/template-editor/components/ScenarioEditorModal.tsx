import React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ScenarioEditorModalProps {
  isOpen: boolean;
  scenarioEditText: string;
  onOpenChange: (open: boolean) => void;
  onScenarioEditTextChange: (text: string) => void;
  onLoadScenario: () => void;
  onResetToDefault: () => void;
}

/**
 * Modal for editing scenario JSON directly
 */
export function ScenarioEditorModal({
  isOpen,
  scenarioEditText,
  onOpenChange,
  onScenarioEditTextChange,
  onLoadScenario,
  onResetToDefault,
}: ScenarioEditorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Scenario JSON</DialogTitle>
          <DialogDescription>
            Modify the scenario configuration. Changes will be applied when you click "Load Scenario".
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <Label htmlFor="scenario-editor" className="text-sm font-medium">
            Scenario Configuration (JSON)
          </Label>
          <Textarea
            id="scenario-editor"
            value={scenarioEditText}
            onChange={e => onScenarioEditTextChange(e.target.value)}
            className="mt-2 font-mono text-sm h-96 resize-none"
            placeholder="Enter scenario JSON here..."
          />
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onResetToDefault}>
            Reset to Default
          </Button>
          <div className="space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={onLoadScenario}>Load Scenario</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
