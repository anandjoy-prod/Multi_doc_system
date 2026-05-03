import { cn } from '@/lib/cn';
import { Sparkles, User as UserIcon } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import { Sources, type SourceChip } from './Sources';
import { ToolTrace, type ToolEvent } from './ToolTrace';

export function MessageBubble({
  role,
  content,
  sources,
  toolEvents,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceChip[];
  toolEvents?: ToolEvent[];
}) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser ? (
        <div
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-accent"
        >
          <Sparkles className="h-4 w-4" />
        </div>
      ) : null}

      <div className={cn('max-w-[80%]', isUser ? 'text-right' : '')}>
        {!isUser && toolEvents && toolEvents.length > 0 ? (
          <ToolTrace events={toolEvents} />
        ) : null}
        <div
          className={cn(
            'rounded-bubble px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'inline-block bg-accent text-white'
              : 'border border-border bg-bg-secondary text-fg-primary',
            !isUser && toolEvents && toolEvents.length > 0 ? 'mt-2' : '',
          )}
        >
          {content === '' ? (
            <TypingDots />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownMessage content={content} />
          )}
        </div>
        {!isUser && sources && sources.length > 0 ? (
          <Sources sources={sources} />
        ) : null}
      </div>

      {isUser ? (
        <div
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-fg-primary"
        >
          <UserIcon className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-fg-secondary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary [animation-delay:240ms]" />
    </span>
  );
}
