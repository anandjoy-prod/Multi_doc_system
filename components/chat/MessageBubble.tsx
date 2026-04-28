import { cn } from '@/lib/cn';
import { Sparkles, User as UserIcon } from 'lucide-react';

export function MessageBubble({
  role,
  content,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-accent">
          <Sparkles className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={cn(
          'max-w-[80%] rounded-bubble px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-accent text-white'
            : 'border border-border bg-bg-secondary text-fg-primary',
        )}
      >
        {content || (
          <span className="inline-flex items-center gap-1 text-fg-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-secondary [animation-delay:240ms]" />
          </span>
        )}
      </div>

      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-fg-primary">
          <UserIcon className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}
