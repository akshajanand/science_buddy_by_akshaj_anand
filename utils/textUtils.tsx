import React from 'react';

export const renderRichText = (text: string) => {
  if (!text) return null;

  // Split by newlines first to handle paragraphs/breaks
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    // Regex to capture **bold** and *italic*
    // Note: This is a basic parser.
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    
    const renderedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={i} className="font-bold text-yellow-300">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i} className="italic text-purple-300">{part.slice(1, -1)}</em>;
      }
      return <span key={i}>{part}</span>;
    });

    return (
      <div key={lineIndex} className="min-h-[1.2em]">
        {renderedLine}
      </div>
    );
  });
};