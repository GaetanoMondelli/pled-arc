"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Home,
  Folder,
  Settings,
  ArrowLeft,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BreadcrumbItem, GroupingViewState } from "@/lib/utils/advancedGroupingUtils";

interface BreadcrumbNavigationProps {
  navigationState: GroupingViewState;
  onNavigateTo: (breadcrumbIndex: number) => void;
  onNavigateBack: () => void;
  onToggleGroupMode: () => void;
  isGroupModeEnabled: boolean;
  className?: string;
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  navigationState,
  onNavigateTo,
  onNavigateBack,
  onToggleGroupMode,
  isGroupModeEnabled,
  className,
}) => {
  const { breadcrumbs, currentView } = navigationState;

  const getIconForBreadcrumb = (item: BreadcrumbItem) => {
    switch (item.type) {
      case 'template':
        return <Home className="h-3 w-3" />;
      case 'group':
        return <Folder className="h-3 w-3" />;
      case 'fsm':
        return <Settings className="h-3 w-3" />;
      default:
        return <Home className="h-3 w-3" />;
    }
  };

  const getColorForBreadcrumb = (item: BreadcrumbItem, isActive: boolean) => {
    if (isActive) {
      switch (item.type) {
        case 'template':
          return "bg-blue-100 text-blue-700 border-blue-200";
        case 'group':
          return "bg-green-100 text-green-700 border-green-200";
        case 'fsm':
          return "bg-orange-100 text-orange-700 border-orange-200";
        default:
          return "bg-gray-100 text-gray-700 border-gray-200";
      }
    }
    return "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100";
  };

  return (
    <div className={cn("flex items-center gap-2 p-3 bg-white border-b border-gray-200", className)}>
      {/* Back Button */}
      {breadcrumbs.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateBack}
          className="h-7 px-2"
        >
          <ArrowLeft className="h-3 w-3" />
        </Button>
      )}

      {/* Breadcrumb Trail */}
      <div className="flex items-center gap-1 flex-1">
        {breadcrumbs.map((item, index) => {
          const isActive = index === breadcrumbs.length - 1;
          const isClickable = index < breadcrumbs.length - 1;

          return (
            <React.Fragment key={`breadcrumb-${item.type}-${item.name}-${index}`}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={isClickable ? () => onNavigateTo(index) : undefined}
                disabled={!isClickable}
                className={cn(
                  "h-7 px-2 gap-1.5 font-medium text-xs",
                  isClickable ? "hover:bg-gray-100 cursor-pointer" : "cursor-default",
                  isActive ? "bg-gray-100" : ""
                )}
              >
                {getIconForBreadcrumb(item)}
                <span className="max-w-32 truncate">{item.displayName}</span>
                {isActive && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 text-[10px] px-1 py-0",
                      getColorForBreadcrumb(item, true)
                    )}
                  >
                    {item.type}
                  </Badge>
                )}
              </Button>
            </React.Fragment>
          );
        })}
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleGroupMode}
          className={cn(
            "h-7 px-2 gap-1.5 text-xs",
            isGroupModeEnabled
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          {isGroupModeEnabled ? (
            <>
              <EyeOff className="h-3 w-3" />
              Grouped
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              All Nodes
            </>
          )}
        </Button>

        {/* Context Info */}
        {currentView !== 'template' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
            {currentView === 'group' && `${navigationState.filteredNodeIds.length} nodes`}
            {currentView === 'fsm' && 'FSM View'}
          </Badge>
        )}
      </div>
    </div>
  );
};

export default BreadcrumbNavigation;