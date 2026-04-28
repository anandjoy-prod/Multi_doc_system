'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

/**
 * Renders an assistant message as markdown. We override only what we need:
 *  - `pre`   → custom CodeBlock with copy button
 *  - `code`  → keep default rendering inside CodeBlock; style inline-code separately
 *  - `a`     → open in new tab, secure rel
 *
 * Everything else (headings, lists, tables via gfm, blockquotes) inherits
 * the .prose-* utility styles below.
 */

const components: Components = {
  pre: ({ children, className }) => (
    <CodeBlock className={className}>{children}</CodeBlock>
  ),

  code: ({ className, children, ...rest }) => {
    // Inline code: react-markdown 9 dropped the `inline` prop, so we detect
    // it by the absence of a language-* class.
    const isInline = !/language-/.test(className ?? '');
    if (isInline) {
      return (
        <code
          className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[12.5px] text-accent"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  ),
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
