import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeCopyPanelProps {
  title: string;
  subtitle?: string;
  code: string;
  maxHeightClass?: string;
}

export function CodeCopyPanel({
  title,
  subtitle,
  code,
  maxHeightClass = 'max-h-96',
}: CodeCopyPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{title}</h4>
          {subtitle && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre
        className={`p-4 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 overflow-auto ${maxHeightClass}`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
