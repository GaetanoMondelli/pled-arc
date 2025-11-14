import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Textarea } from "./textarea";
import { Code2 } from "lucide-react";

interface FSMDefinitionModalProps {
  definition: string;
  onChange: (value: string) => void;
}

export const FSMDefinitionModal = ({ definition, onChange }: FSMDefinitionModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Code2 className="h-4 w-4" />
          View Machine Definition
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>State Machine Definition</DialogTitle>
        </DialogHeader>
        <Textarea
          value={definition}
          onChange={e => onChange(e.target.value)}
          className="min-h-[300px] font-mono"
          placeholder="Enter state machine definition..."
        />
      </DialogContent>
    </Dialog>
  );
};
