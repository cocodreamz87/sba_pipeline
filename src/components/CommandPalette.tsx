import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  Database,
  Layers,
  Moon,
  RefreshCw,
  Scale,
  Search,
  Sun,
  Webhook,
} from 'lucide-react';
import type { NavTab, Prospect } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  prospects: Prospect[];
  darkMode: boolean;
  onSelectTab: (tab: NavTab) => void;
  onSelectProspect: (prospectId: string) => void;
  onSimulateError: () => Promise<void>;
  onRollupCare: () => Promise<void>;
  onToggleDark: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Navigation' | 'Operators' | 'Quick Actions';
  label: string;
  hint: string;
  icon: typeof Layers;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  prospects,
  darkMode,
  onSelectTab,
  onSelectProspect,
  onSimulateError,
  onRollupCare,
  onToggleDark,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [
      {
        id: 'nav-agent',
        group: 'Navigation',
        label: 'Prospecting Agent',
        hint: 'Discover, audit, qualify & draft Tier 1–3 outreach',
        icon: Bot,
        run: () => onSelectTab('agent'),
      },
      {
        id: 'nav-queue',
        group: 'Navigation',
        label: 'Daily Queue & Leads',
        hint: 'Outbound priority + Neon prospects',
        icon: Layers,
        run: () => onSelectTab('queue'),
      },
      {
        id: 'nav-webhook',
        group: 'Navigation',
        label: 'Webhook & Make',
        hint: '3-pane CF Worker + Make delivery inspector',
        icon: Webhook,
        run: () => onSelectTab('webhook'),
      },
      {
        id: 'nav-runs',
        group: 'Navigation',
        label: 'Run Logs & Neon SQL',
        hint: 'Make automation_runs + DDL library',
        icon: Database,
        run: () => onSelectTab('runs'),
      },
      {
        id: 'nav-care',
        group: 'Navigation',
        label: 'Plans & Client Care (Tiers 1–3)',
        hint: 'Tier 1 Sprint, Tier 2 ($650/mo) & Tier 3 ($1,250/mo) ledger',
        icon: Activity,
        run: () => onSelectTab('care'),
      },
      {
        id: 'nav-triage',
        group: 'Navigation',
        label: 'Scope & Change Orders',
        hint: 'Bug fix vs. $750 change order triage',
        icon: Scale,
        run: () => onSelectTab('triage'),
      },
    ];

    const actionItems: PaletteItem[] = [
      {
        id: 'act-sim-err',
        group: 'Quick Actions',
        label: 'Simulate Make Scenario Failure',
        hint: 'Logs error to automation_runs & generates Slack alert',
        icon: AlertTriangle,
        run: () => void onSimulateError(),
      },
      {
        id: 'act-rollup',
        group: 'Quick Actions',
        label: 'Roll Up Monthly Care Metrics',
        hint: 'Aggregates automation_runs into tier2_monthly_care_logs',
        icon: RefreshCw,
        run: () => void onRollupCare(),
      },
      {
        id: 'act-theme',
        group: 'Quick Actions',
        label: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        hint: 'Toggle console color theme',
        icon: darkMode ? Sun : Moon,
        run: () => onToggleDark(),
      },
    ];

    const prospectItems: PaletteItem[] = prospects.map((p) => ({
      id: `prospect-${p.id}`,
      group: 'Operators',
      label: p.borr_name,
      hint: `${p.borr_city}, ${p.borr_state} · Score ${p.computed_lead_score} · ${p.outreach_status}`,
      icon: Building2,
      run: () => onSelectProspect(p.id),
    }));

    const all = [...navItems, ...actionItems, ...prospectItems];
    const q = query.trim().toLowerCase();
    if (!q) return [...navItems, ...actionItems, ...prospectItems.slice(0, 5)];
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [prospects, query, darkMode, onSelectTab, onSelectProspect, onSimulateError, onRollupCare, onToggleDark]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].run();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, activeIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="fixed inset-0 bg-zinc-950/40 dark:bg-black/65 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to view, SBA operator, or quick action..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No matching views, operators, or actions.
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/50 text-zinc-950 dark:text-zinc-50'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{item.label}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{item.hint}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0">
                    {item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>↑↓ Navigate · ↵ Open</span>
          <span className="font-mono">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
