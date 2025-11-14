import React, { useState, useMemo } from "react";
import { Tags as TagsIcon, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSimulationStore } from "@/stores/simulationStore";

interface NodeTagsEditorProps {
  nodeConfig: any;
  onTagsUpdate: (newTags: string[]) => void;
}

export const NodeTagsEditor: React.FC<NodeTagsEditorProps> = ({ nodeConfig, onTagsUpdate }) => {
  const scenario = useSimulationStore(state => state.scenario);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const currentTags = nodeConfig.tags || [];

  // Get available tags from scenario (both from registry and existing nodes)
  const availableTags = useMemo(() => {
    if (!scenario) return [];

    const allTags = new Set<string>();

    // Add tags from the global tag registry
    if (scenario.groups?.tags) {
      scenario.groups.tags.forEach((tag: any) => allTags.add(tag.name));
    }

    // Add tags from existing nodes
    if (scenario.nodes) {
      scenario.nodes.forEach((node: any) => {
        if (node.tags) {
          node.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
    }

    return Array.from(allTags).filter(tag => !currentTags.includes(tag));
  }, [scenario, currentTags]);

  const handleAddTag = (tag: string) => {
    if (tag && !currentTags.includes(tag)) {
      onTagsUpdate([...currentTags, tag]);
    }
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsUpdate(currentTags.filter((tag: string) => tag !== tagToRemove));
  };

  const handleCreateNewTag = () => {
    if (newTagInput.trim()) {
      handleAddTag(newTagInput.trim());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <TagsIcon className="h-4 w-4" />
          Tags
          <Badge variant="outline" className="text-xs">
            {currentTags.length}
          </Badge>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => setIsAddingTag(!isAddingTag)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Current Tags */}
      <div className="flex flex-wrap gap-2">
        {currentTags.map((tag: string) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-xs px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-red-100 hover:text-red-700 group"
            onClick={() => handleRemoveTag(tag)}
            title={`Click to remove "${tag}"`}
          >
            {tag}
            <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Badge>
        ))}
        {currentTags.length === 0 && (
          <span className="text-xs text-gray-500 italic">No tags assigned</span>
        )}
      </div>

      {/* Add Tag Interface */}
      {isAddingTag && (
        <div className="space-y-2">
          {/* Available Tags */}
          {availableTags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Available Tags:</div>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs px-2 py-1 cursor-pointer hover:bg-blue-100 hover:border-blue-300"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Create New Tag */}
          <div className="flex gap-2">
            <Input
              placeholder="Create new tag..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateNewTag();
                }
                if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTagInput("");
                }
              }}
              className="h-7 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleCreateNewTag}
              disabled={!newTagInput.trim()}
            >
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setIsAddingTag(false);
                setNewTagInput("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
