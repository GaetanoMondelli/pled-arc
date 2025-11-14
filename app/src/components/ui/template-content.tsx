"use client";

import { Calendar, User } from "lucide-react";

export const formatTemplateContent = (content: string, variables: any) => {
  return content.split(/(\{\{[^}]+\}\})/).map((part, index) => {
    if (part.startsWith("{{")) {
      const variable = part.slice(2, -2).trim();

      // Check if it's an event variable
      if (variable.startsWith("event.")) {
        return (
          <span key={index} className="text-blue-500 group relative inline-flex items-center">
            <Calendar className="h-3 w-3 inline mr-1" />
            {part}
            <span className="hidden group-hover:block absolute -top-8 left-0 bg-black text-white text-xs p-1 rounded z-50">
              Event Variable
            </span>
          </span>
        );
      }

      // Instance variable
      return (
        <span key={index} className="text-green-500 group relative inline-flex items-center">
          <User className="h-3 w-3 inline mr-1" />
          {part}
          <span className="hidden group-hover:block absolute -top-8 left-0 bg-black text-white text-xs p-1 rounded z-50">
            Instance Variable
          </span>
        </span>
      );
    }
    return part;
  });
};
