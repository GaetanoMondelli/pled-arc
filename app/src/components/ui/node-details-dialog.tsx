import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Activity, Bell, Calendar, FileSignature, FileText, LucideIcon, Mail, Play } from "lucide-react";

interface NodeDetailsDialogProps {
  node: {
    id: string;
    metadata?: {
      description?: string;
      actions?: string[];
    };
  } | null;
  isOpen: boolean;
  onClose: () => void;
  documents?: {
    contracts?: Array<{
      id: string;
      name: string;
      linkedStates?: string[];
    }>;
  };
  procedureId: string;
}

// Define action type icons mapping with lowercase keys
const actionIcons: Record<string, LucideIcon> = {
  send_email: Mail,
  create_calendar_event: Calendar,
  send_reminder: Bell,
  docusign_send: FileSignature,
};

const defaultActionIcon = Activity;

// Helper function to get the icon for an action
export const getActionIcon = (action: any): LucideIcon => {
  // Extract type from our action structure
  const actionType = action?.type?.toLowerCase() || action?.template?.data?.type?.toLowerCase() || "unknown";
  return actionIcons[actionType] || defaultActionIcon;
};

export const NodeDetailsDialog: React.FC<NodeDetailsDialogProps> = ({
  node,
  isOpen,
  onClose,
  documents,
  procedureId,
}) => {
  const router = useRouter();

  if (!node) return null;

  const linkedDocuments = documents?.contracts?.filter(doc => doc.linkedStates?.includes(node.id)) || [];

  const handleDocumentClick = (docId: string) => {
    router.push(`/procedures/${procedureId}/envelope?doc=${docId}`);
    onClose();
  };

  const handleTestAction = async (action: any) => {
    try {
      // Create event from action template
      const event = {
        id: `evt_${Date.now()}`,
        name: `${action.type} Event`,
        description: `${action.type} event created from action test`,
        type: action.type,
        template: {
          source: "action",
          data: action.template?.data || {},
        },
        timestamp: new Date().toISOString(),
      };

      // Add event to database
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          action: "add",
          procedureId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create test event");
      }

      console.log("Test event created:", event);
    } catch (error) {
      console.error("Error testing action:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">State: {node.id}</DialogTitle>
          <DialogDescription>{node.metadata?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {(node.metadata?.actions?.length ?? 0) > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Actions</h4>
              <div className="space-y-2">
                {node.metadata?.actions?.map((action: any, index: number) => {
                  const ActionIcon = getActionIcon(action);
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                      <div className="flex items-center gap-2">
                        <ActionIcon className="h-4 w-4" />
                        <span>{action.type || action.template?.data?.type || "Unknown Action"}</span>
                      </div>
                      <Button size="sm" onClick={() => handleTestAction(action)} className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Test Action
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {linkedDocuments.length > 0 && (
            <div>
              <h3 className="text-base font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 stroke-current fill-none" />
                Linked Documents
              </h3>
              <div className="grid gap-2">
                {linkedDocuments.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc.id)}
                    className="text-left p-3 border rounded-lg hover:bg-accent flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4 stroke-current fill-none" />
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">Click to view details</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
