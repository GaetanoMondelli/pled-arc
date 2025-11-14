"use client";

import React from "react";

// Simple JSON display component
export const SimpleJsonView: React.FC<{ value: any }> = ({ value }) => {
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded border overflow-auto max-h-64">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};
