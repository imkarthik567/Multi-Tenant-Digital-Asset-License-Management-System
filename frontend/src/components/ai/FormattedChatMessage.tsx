import React from 'react';

interface FormattedChatMessageProps {
  text: string;
  isUser?: boolean;
}

/**
 * Renders inline markdown (**bold**, `code`) into styled React elements.
 */
function renderInlineTokens(line: string, isUser?: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold** or `code`
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const content = token.slice(2, -2);
      nodes.push(
        <strong
          key={`b-${match.index}`}
          className={isUser ? 'font-bold text-white' : 'font-semibold text-slate-900 dark:text-white'}
        >
          {content}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const content = token.slice(1, -1);
      nodes.push(
        <code
          key={`c-${match.index}`}
          className={
            isUser
              ? 'font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-700/80 text-indigo-100 border border-indigo-400/30 tabular-nums'
              : 'font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-950/90 text-indigo-700 dark:text-indigo-300 border border-slate-300/80 dark:border-slate-700/80 tabular-nums'
          }
        >
          {content}
        </code>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

/**
 * Safely renders conversational AI markdown (paragraphs, headings, bullet points, numbered lists,
 * bold labels, and inline code badges) without raw asterisks or backticks.
 */
export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ text, isUser = false }) => {
  const sanitized = String(text || '').replace(/\[object Object\]/g, 'TENANT_ADMIN');
  const lines = sanitized.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Markdown headings (### or ## or #)
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          return (
            <div
              key={idx}
              className={`font-semibold pt-1 ${
                isUser ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}
            >
              {renderInlineTokens(headingMatch[2], isUser)}
            </div>
          );
        }

        // Bullet list items (•, -, or *)
        const bulletMatch = trimmed.match(/^([•\-*])\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  isUser ? 'bg-indigo-200' : 'bg-indigo-500 dark:bg-indigo-400'
                }`}
              />
              <div className="flex-1 min-w-0 break-words">
                {renderInlineTokens(bulletMatch[2], isUser)}
              </div>
            </div>
          );
        }

        // Numbered list items (1. , 2. )
        const numberedMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span
                className={`font-mono text-[11px] font-semibold shrink-0 tabular-nums ${
                  isUser ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {numberedMatch[1]}
              </span>
              <div className="flex-1 min-w-0 break-words">
                {renderInlineTokens(numberedMatch[2], isUser)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="break-words">
            {renderInlineTokens(trimmed, isUser)}
          </p>
        );
      })}
    </div>
  );
};
