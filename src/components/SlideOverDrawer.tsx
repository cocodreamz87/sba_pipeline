import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerMeta?: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  children: ReactNode;
}

export function SlideOverDrawer({
  open,
  onClose,
  title,
  subtitle,
  headerMeta,
  footer,
  widthClass = 'max-w-xl',
  children,
}: SlideOverDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="fixed inset-0 bg-zinc-950/35 dark:bg-black/60 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${widthClass} bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full`}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            {headerMeta && (
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1 truncate">
                {headerMeta}
              </div>
            )}
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
