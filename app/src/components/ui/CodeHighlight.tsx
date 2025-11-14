import React from 'react';

interface CodeHighlightProps {
  code: string;
  language?: 'javascript' | 'typescript';
  className?: string;
}

interface Token {
  text: string;
  type: 'keyword' | 'string' | 'number' | 'comment' | 'operator' | 'function' | 'normal';
}

export const CodeHighlight: React.FC<CodeHighlightProps> = ({
  code,
  language = 'javascript',
  className = ''
}) => {
  const tokenize = (code: string): Token[] => {
    // Simple tokenization by splitting and classifying
    const parts = code.split(/(\s+|[^\w\s.'"`])/);

    return parts.map(part => {
      if (!part.trim()) return { text: part, type: 'normal' as const };

      // Keywords
      if (/^(const|let|var|function|return|if|else|for|while|class|new|this|Date|Math)$/.test(part)) {
        return { text: part, type: 'keyword' as const };
      }
      // Strings (simple detection)
      if (/^['"`].*['"`]$/.test(part) || /^['"`]/.test(part)) {
        return { text: part, type: 'string' as const };
      }
      // Numbers
      if (/^\d+\.?\d*$/.test(part)) {
        return { text: part, type: 'number' as const };
      }
      // Operators
      if (/^[+\-*/%=<>!&|]+$/.test(part)) {
        return { text: part, type: 'operator' as const };
      }
      // Functions (followed by parenthesis)
      if (/\w+$/.test(part) && code.indexOf(part + '(') !== -1) {
        return { text: part, type: 'function' as const };
      }

      return { text: part, type: 'normal' as const };
    });
  };

  const getTokenStyle = (type: Token['type']) => {
    switch (type) {
      case 'keyword': return 'text-blue-600 font-semibold';
      case 'string': return 'text-green-600';
      case 'number': return 'text-purple-600';
      case 'comment': return 'text-gray-500 italic';
      case 'operator': return 'text-red-500';
      case 'function': return 'text-indigo-600';
      default: return 'text-gray-800';
    }
  };

  if (language === 'javascript') {
    const tokens = tokenize(code);
    return (
      <pre className={`font-mono text-sm bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap ${className}`}>
        {tokens.map((token, index) => (
          <span key={index} className={getTokenStyle(token.type)}>
            {token.text}
          </span>
        ))}
      </pre>
    );
  }

  // Fallback for non-JavaScript
  return (
    <pre className={`font-mono text-sm bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap ${className}`}>
      {code}
    </pre>
  );
};