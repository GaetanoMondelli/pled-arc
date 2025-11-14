"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationText?: string; // If provided, user must type this to confirm
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void> | void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationText,
  confirmButtonText = "Delete",
  cancelButtonText = "Cancel",
  variant = "destructive",
  onConfirm,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (confirmationText && inputValue !== confirmationText) {
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setInputValue("");
    } catch (error) {
      console.error("Confirmation action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setInputValue("");
  };

  const canConfirm = !confirmationText || inputValue === confirmationText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left pt-2">{description}</DialogDescription>
        </DialogHeader>

        {confirmationText && (
          <div className="py-4">
            <Label htmlFor="confirmation-input" className="text-sm font-medium">
              Type <span className="font-bold text-destructive">{confirmationText}</span> to confirm:
            </Label>
            <Input
              id="confirmation-input"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="mt-2"
              placeholder={confirmationText}
              disabled={isLoading}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            {cancelButtonText}
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={!canConfirm || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
