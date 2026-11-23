import { useState, type ReactNode } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  Menu,
  Moon,
  RefreshCw,
  Scale,
  Search,
  Sun,
  Upload,
  Webhook,
  X,
} from 'lucide-react';
import type { NavTab, OverviewResponse } from '../types';

export interface ShellNavGroup {
  heading: string;
  items: {
    id: NavTab;
    label: string;
    icon: typeof Layers;
    count?: number;
    countTone?: 'neutral' | 'accent' | 'alert';
  }[];
}

interface DashboardShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  overview: OverviewResponse | null;
  darkMode: boolean;
  onToggleDark: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenCommandPalette: () => void;
  onOpenCsvImport: () => void;
  queueCount: number;
  errorRunCount: number;
  children: ReactNode;
}

export function DashboardShell({
  activeTab,
  onSelectTab,
  overview,
  darkMode,
  onToggleDark,
  refreshing,
  onRefresh,
  onOpenCommandPalette,
  onOpenCsvImport,
  queueCount,
  errorRunCount,
  children,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navGroups: ShellNavGroup[] = [
    {
      heading: 'Pipeline & Ingress',
      items: [
        {
          id: 'queue',
          label: 'Daily Queue & Leads',
          icon: Layers,
          count: queueCount,
          countTone: queueCount > 0 ? 'accent' : 'neutral',
        },
        {
          id: 'webhook',
          label: 'Webhook & Make',
          icon: Webhook,
        },
      ],
    },
    {
      heading: 'Agency Tiers & Ops',
      items: [
        {
          id: 'runs',
          label: 'Run Logs & Neon SQL',
          icon: Database,
          count: errorRunCount,
          countTone: errorRunCount > 0 ? 'alert' : 'neutral',
        },
        {
          id: 'care',
          label: 'Plans & Client Care',
          icon: Activity,
        },
        {
          id: 'triage',
          label: 'Scope & Change Orders',
          icon: Scale,
        },
      ],
    },
  ];

  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((i) => i.id === activeTab) || allItems[0];

  const renderSidebarBody = (isMobile: boolean) => {
    const compact = !isMobile && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full">
        {/* Workspace Brand Header */}
        <div
          className={`h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center shrink-0 ${
            compact ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!compact && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap truncate">
                Coco Club Live
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Web Automation Agency
              </div>
            </div>
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {compact ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Grouped Navigation */}
        <nav className="p-2.5 space-y-5 flex-1 overflow-y-auto" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.heading} className="space-y-1">
              {!compact && (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const countColor =
                  item.countTone === 'alert'
                    ? 'text-rose-600 dark:text-rose-400'
                    : item.countTone === 'accent'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-zinc-400 dark:text-zinc-500';

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={compact ? item.label : undefined}
                    onClick={() => {
                      onSelectTab(item.id);
                      if (isMobile) setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center ${
                      compact ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                    } text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </span>
                    {!compact && typeof item.count === 'number' && item.count > 0 && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ml-2 ${
                          isActive ? 'text-zinc-300 dark:text-zinc-600' : countColor
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Active Stack & Tiers Summary Footer */}
        {!compact && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-2 shrink-0">
            <div className="space-y-1">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                Service Tiers
              </div>
              <div className="font-mono tabular-nums">T1 $3.5k · T2 $650/m · T3 $1,250/m</div>
            </div>
            <div className="space-y-1 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                Active Stack
              </div>
              <div>Make · Neon Postgres · Airtable</div>
              <div>CF Worker (Secret) · Slack</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <aside
        className={`hidden lg:flex shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col transition-all duration-150 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs border-b border-zinc-200 dark:border-zinc-800 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
              Coco Club Live
            </span>
            <span aria-hidden="true">/</span>
            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{activeItem.label}</span>
            {overview && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline font-mono text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {overview.storageMode === 'neon_postgres' ? 'Neon Connected' : 'In-Memory Store'}
                </span>
                {overview.lastSyncedAt && (
                  <span className="hidden md:inline font-mono text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap tabular-nums">
                    · Synced {overview.lastSyncedAt.slice(11, 19)}Z
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Command Palette (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick Jump</span>
              <kbd className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded px-1">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={onToggleDark}
              className="p-1.5 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Toggle light/dark theme"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1.5 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Refresh operational data"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'queue' && (
              <button
                type="button"
                onClick={onOpenCsvImport}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import SBA CSV</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-5">{children}</main>
      </div>
    </div>
  );
}
