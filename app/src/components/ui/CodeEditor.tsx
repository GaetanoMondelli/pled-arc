import React, { useState, useRef, useEffect } from 'react';
import { CodeHighlight } from './CodeHighlight';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  language?: 'javascript' | 'typescript';
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  className = '',
  language = 'javascript'
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const highlightDiv = textarea.parentElement?.querySelector('.code-highlight-overlay') as HTMLElement;
      if (highlightDiv) {
        highlightDiv.scrollTop = textarea.scrollTop;
        highlightDiv.scrollLeft = textarea.scrollLeft;
      }
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Syntax highlighted overlay */}
      {!isFocused && value && (
        <div
          className="code-highlight-overlay absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            fontSize: 'inherit',
            fontFamily: 'inherit',
            lineHeight: 'inherit',
            padding: '0.5rem',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
        >
          <CodeHighlight
            code={value}
            language={language}
            className="text-[10px] bg-transparent p-0 border-0 m-0"
          />
        </div>
      )}

      {/* Editable textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`
          w-full h-16 text-[10px] font-mono border rounded px-2 py-1 resize-none
          ${isFocused ? 'bg-white' : 'bg-transparent text-transparent caret-black'}
          relative z-10
        `}
        style={{
          lineHeight: 'inherit'
        }}
      />
    </div>
  );
};