import React from 'react';
import * as Diff from 'diff';

interface GitDiffProps {
  oldText: string;
  newText: string;
  filename?: string;
  className?: string;
}

export const GitDiff: React.FC<GitDiffProps> = ({
  oldText,
  newText,
  filename = 'document.md',
  className = ''
}) => {
  const diff = Diff.createPatch(filename, oldText, newText, '', '', { context: 3 });

  // Parse the diff output to extract the meaningful lines
  const lines = diff.split('\n').slice(4); // Skip the header lines

  const renderDiffLine = (line: string, index: number) => {
    const firstChar = line.charAt(0);

    if (firstChar === '+') {
      return (
        <div
          key={index}
          className="flex bg-green-50 border-l-4 border-green-400"
        >
          <span className="text-green-600 font-mono text-sm px-2 py-1 select-none">+</span>
          <span className="text-green-800 font-mono text-sm py-1 pr-2 flex-1">
            {line.substring(1)}
          </span>
        </div>
      );
    } else if (firstChar === '-') {
      return (
        <div
          key={index}
          className="flex bg-red-50 border-l-4 border-red-400"
        >
          <span className="text-red-600 font-mono text-sm px-2 py-1 select-none">-</span>
          <span className="text-red-800 font-mono text-sm py-1 pr-2 flex-1">
            {line.substring(1)}
          </span>
        </div>
      );
    } else if (firstChar === ' ') {
      return (
        <div
          key={index}
          className="flex bg-gray-50 border-l-4 border-gray-200"
        >
          <span className="text-gray-400 font-mono text-sm px-2 py-1 select-none"> </span>
          <span className="text-gray-700 font-mono text-sm py-1 pr-2 flex-1">
            {line.substring(1)}
          </span>
        </div>
      );
    } else if (line.startsWith('@@')) {
      return (
        <div
          key={index}
          className="flex bg-blue-50 border-l-4 border-blue-400"
        >
          <span className="text-blue-600 font-mono text-sm px-2 py-1 select-none">@@</span>
          <span className="text-blue-800 font-mono text-sm py-1 pr-2 flex-1">
            {line.substring(2)}
          </span>
        </div>
      );
    } else if (line.trim() === '') {
      return <div key={index} className="h-1"></div>; // Empty line
    }

    return null;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-mono text-sm">📝</span>
          <span className="text-gray-800 font-medium text-sm">{filename}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-96 overflow-y-auto">
        {lines.filter(line => line.trim() !== '').map((line, index) => renderDiffLine(line, index))}
      </div>
    </div>
  );
};

export default GitDiff;