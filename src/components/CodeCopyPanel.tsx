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
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate">{title}</h4>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className={`p-4 text-xs leading-relaxed text-slate-800 bg-white overflow-auto ${maxHeightClass}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
