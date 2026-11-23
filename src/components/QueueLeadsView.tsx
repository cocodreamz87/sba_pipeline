import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Upload,
  X,
} from 'lucide-react';
import type { OutreachTouch, OverviewResponse, Prospect } from '../types';
import { Sparkline } from './MicroCharts';
import { SlideOverDrawer } from './SlideOverDrawer';
import { CodeCopyPanel } from './CodeCopyPanel';

interface QueueLeadsViewProps {
  overview: OverviewResponse | null;
  prospects: Prospect[];
  touches: OutreachTouch[];
  dueNudges: Prospect[];
  freshHighScore: Prospect[];
  slackDigest: unknown;
  csvImportOpen: boolean;
  onCloseCsvImport: () => void;
  onOpenCsvImport: () => void;
  externalSelectedProspectId: string | null;
  onClearExternalSelectedProspect: () => void;
  onRefresh: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error') => void;
}

type SavedView = 'queue' | 'due' | 'new60' | 'all' | 'replies' | 'airtable';

const SAMPLE_CSV = `BorrName,BorrStreet,BorrCity,BorrState,BorrZip,ApprovalDate,GrossApproval,NaicsCode,NaicsDescription,BusinessAge,google_review_count,website_url,has_booking_link,owner_name,owner_email
MAGNOLIA PLUMBING & DRAIN LLC,912 PEACHTREE ST NE,Atlanta,GA,30309,2026-02-18,620000,238220,Plumbing & HVAC,CHANGE OF OWNERSHIP,94,https://magnoliaplumbing.example.com,FALSE,Tanya Brooks,tanya@magnoliaplumbing.example.com
ATLANTA REALTY HOLDINGS LLC,100 MAIN ST,Atlanta,GA,30303,2026-01-10,1200000,531110,Lessors of Real Estate,EXISTING OR MORE THAN 2 YEARS OLD,12,,FALSE,,
TAMPA BAY AUTO SERVICE INC,4410 DALE MABRY HWY,Tampa,FL,33614,2025-10-04,485000,811111,General Automotive Repair,EXISTING OR MORE THAN 2 YEARS OLD,112,,FALSE,Carlos Mendez,carlos@tampabayauto.example.com`;

const STATUS_OPTIONS = ['new', 'enriched', 'ready', 'audit_queued', 'contacted', 'replied', 'booked', 'won', 'disqualified'];

export function QueueLeadsView({
  overview,
  prospects,
  touches,
  dueNudges,
  freshHighScore,
  slackDigest,
  csvImportOpen,
  onCloseCsvImport,
  onOpenCsvImport,
  externalSelectedProspectId,
  onClearExternalSelectedProspect,
  onRefresh,
  onToast,
}: QueueLeadsViewProps) {
  const [savedView, setSavedView] = useState<SavedView>('queue');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [minScore, setMinScore] = useState<number>(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const [activeProspectId, setActiveProspectId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [slackDrawerOpen, setSlackDrawerOpen] = useState(false);

  // CSV Import state
  const [csvInput, setCsvInput] = useState(SAMPLE_CSV);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Drawer form states
  const [editStatus, setEditStatus] = useState('ready');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editOwnerPhone, setEditOwnerPhone] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [savingProspect, setSavingProspect] = useState(false);

  const [touchChannel, setTouchChannel] = useState<'email' | 'phone_call' | 'voicemail' | 'linkedin'>('email');
  const [touchSubject, setTouchSubject] = useState('');
  const [touchSummary, setTouchSummary] = useState('');
  const [loggingTouch, setLoggingTouch] = useState(false);

  const combinedQueue = useMemo(() => [...dueNudges, ...freshHighScore], [dueNudges, freshHighScore]);

  useEffect(() => {
    if (externalSelectedProspectId) {
      setActiveProspectId(externalSelectedProspectId);
      onClearExternalSelectedProspect();
    }
  }, [externalSelectedProspectId, onClearExternalSelectedProspect]);

  const activeProspect = useMemo(
    () => prospects.find((p) => p.id === activeProspectId) || null,
    [prospects, activeProspectId]
  );

  useEffect(() => {
    if (!activeProspect) return;
    setEditStatus(activeProspect.outreach_status);
    setEditOwnerName(activeProspect.owner_name || '');
    setEditOwnerEmail(activeProspect.owner_email || '');
    setEditOwnerPhone(activeProspect.owner_phone || '');
    setEditFollowup(activeProspect.next_followup_at ? activeProspect.next_followup_at.slice(0, 10) : '');
    setTouchSubject(`${activeProspect.borr_name} — quick intake teardown`);
    setTouchSummary('');
  }, [activeProspect]);

  const distinctStates = useMemo(
    () => ['ALL', ...Array.from(new Set(prospects.map((p) => p.borr_state))).sort()],
    [prospects]
  );

  const distinctTracks = useMemo(
    () => ['ALL', ...Array.from(new Set(prospects.map((p) => p.campaign_track))).sort()],
    [prospects]
  );

  const baseList = useMemo(() => {
    if (savedView === 'queue') return combinedQueue;
    if (savedView === 'due') return dueNudges;
    if (savedView === 'new60') return freshHighScore;
    if (savedView === 'replies') return prospects.filter((p) => p.inbound_replies > 0 || p.outreach_status === 'replied');
    return prospects;
  }, [savedView, combinedQueue, dueNudges, freshHighScore, prospects]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseList.filter((p) => {
      if (stateFilter !== 'ALL' && p.borr_state !== stateFilter) return false;
      if (trackFilter !== 'ALL' && p.campaign_track !== trackFilter) return false;
      if (p.computed_lead_score < minScore) return false;
      if (!q) return true;
      return (
        p.borr_name.toLowerCase().includes(q) ||
        p.borr_city.toLowerCase().includes(q) ||
        p.borr_state.toLowerCase().includes(q) ||
        p.campaign_track.toLowerCase().includes(q) ||
        p.owner_name.toLowerCase().includes(q) ||
        p.friction_tags.toLowerCase().includes(q)
      );
    });
  }, [baseList, search, stateFilter, trackFilter, minScore]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [savedView, search, stateFilter, trackFilter, minScore]);

  // Keyboard navigation: j / k / Enter when drawer & modals are closed
  useEffect(() => {
    if (activeProspectId || csvImportOpen || slackDrawerOpen || savedView === 'airtable') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((prev) => (visibleRows.length > 0 ? Math.min(visibleRows.length - 1, prev + 1) : 0));
      } else if (e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' && visibleRows[focusedIndex]) {
        e.preventDefault();
        setActiveProspectId(visibleRows[focusedIndex].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeProspectId, csvImportOpen, slackDrawerOpen, savedView, visibleRows, focusedIndex]);

  const hasActiveFilters = search.trim() !== '' || stateFilter !== 'ALL' || trackFilter !== 'ALL' || minScore > 0;

  const clearAllFilters = () => {
    setSearch('');
    setStateFilter('ALL');
    setTrackFilter('ALL');
    setMinScore(0);
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    const visibleIds = visibleRows.map((r) => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const runBatchAction = async (action: 'mark_ready' | 'snooze_3d' | 'mark_contacted' | 'disqualify') => {
    if (selectedIds.length === 0) return;
    setBatchBusy(true);
    try {
      const res = await fetch('/api/prospects/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast(`Updated ${data.updated} operator(s) · ${action.replace('_', ' ')}`);
        setSelectedIds([]);
        await onRefresh();
      } else {
        onToast(data.error || 'Batch update failed', 'error');
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const handleSaveProspect = async () => {
    if (!activeProspect) return;
    setSavingProspect(true);
    try {
      const res = await fetch(`/api/prospects/${activeProspect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outreach_status: editStatus,
          owner_name: editOwnerName,
          owner_email: editOwnerEmail,
          owner_phone: editOwnerPhone,
          next_followup_at: editFollowup ? `${editFollowup}T15:00:00Z` : null,
        }),
      });
      if (res.ok) {
        onToast(`Saved ${activeProspect.borr_name}`);
        await onRefresh();
      } else {
        onToast('Failed to update prospect', 'error');
      }
    } finally {
      setSavingProspect(false);
    }
  };

  const handleLogTouch = async () => {
    if (!activeProspect) return;
    setLoggingTouch(true);
    try {
      const res = await fetch(`/api/prospects/${activeProspect.id}/touches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: touchChannel,
          subject_line: touchSubject,
          message_summary: touchSummary || `Logged ${touchChannel} touch for ${activeProspect.borr_name}`,
          outcome: 'sent',
        }),
      });
      if (res.ok) {
        setTouchSummary('');
        onToast(`Logged ${touchChannel} touch · next follow-up scheduled (+3d)`);
        await onRefresh();
      } else {
        onToast('Failed to log outreach touch', 'error');
      }
    } finally {
      setLoggingTouch(false);
    }
  };

  const handleRunProcess = async () => {
    setImporting(true);
    setImportSummary(null);
    try {
      const res = await fetch('/api/prospects/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvInput, program: '7a' }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = `Scanned ${data.scanned} rows · ${data.matched} matched deterministic rules · ${data.added} added · ${data.merged} merged`;
        setImportSummary(msg);
        onToast(msg);
        await onRefresh();
      } else {
        setImportSummary(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const activeTouches = useMemo(
    () => (activeProspect ? touches.filter((t) => t.prospect_id === activeProspect.id) : []),
    [touches, activeProspect]
  );

  const statusTone = (status: string) => {
    if (['replied', 'booked', 'won'].includes(status)) return 'text-emerald-700 dark:text-emerald-400';
    if (status === 'ready') return 'text-indigo-600 dark:text-indigo-400';
    if (status === 'contacted') return 'text-amber-700 dark:text-amber-400';
    if (status === 'disqualified') return 'text-zinc-400 dark:text-zinc-500 line-through';
    return 'text-zinc-600 dark:text-zinc-300';
  };

  return (
    <div className="space-y-5">
      {/* Asymmetric 3-Tile Context Bento Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Morning Triage Focus
            </div>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
                {combinedQueue.length}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {dueNudges.length} due · {freshHighScore.length} ready 60+
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono">
              {touches.length} touches logged · press <span className="text-zinc-800 dark:text-zinc-200">j/k</span> + <span className="text-zinc-800 dark:text-zinc-200">↵</span>
            </div>
          </div>
          {overview?.trends?.touches14d && (
            <div className="text-right shrink-0">
              <Sparkline data={overview.trends.touches14d} color="#4f46e5" height={34} width={116} />
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-1">14d touch velocity</div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Qualified Pipeline Health
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
              {prospects.length} operators
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
              ${((overview?.metrics.pipelineVolume ?? 0) / 1_000_000).toFixed(2)}M
            </span>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
              Avg score {overview?.metrics.avgLeadScore ?? 0}/100
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            7(a) + 504 deduped via SHA-256 · GA/FL/TX/NC/TN
          </div>
        </div>

        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              8:00 AM ET Make Digest
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
              Slack Block Kit (#sba-outreach) synced with Airtable CRM
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSlackDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Preview Slack Digest</span>
            </button>
          </div>
        </div>
      </div>

      {/* Saved View Tabs + Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
            {(
              [
                ['queue', `Action Queue (${combinedQueue.length})`],
                ['due', `Due Follow-Ups (${dueNudges.length})`],
                ['new60', `New 60+ (${freshHighScore.length})`],
                ['all', `All Prospects (${prospects.length})`],
                ['replies', `Replies (${prospects.filter((p) => p.inbound_replies > 0 || p.outreach_status === 'replied').length})`],
                ['airtable', 'Airtable Mapping'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSavedView(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  savedView === key
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenCsvImport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import SBA CSV</span>
          </button>
        </div>

        {savedView !== 'airtable' && (
          <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5">
            <div className="relative flex-1 min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, city, owner, friction signal..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                aria-label="Filter by state"
                className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                {distinctStates.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? 'All States' : st}
                  </option>
                ))}
              </select>

              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                aria-label="Filter by campaign track"
                className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                {distinctTracks.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr === 'ALL' ? 'All Tracks' : tr}
                  </option>
                ))}
              </select>

              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                aria-label="Minimum lead score"
                className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                <option value={0}>Score: Any</option>
                <option value={60}>Score: 60+</option>
                <option value={80}>Score: 80+</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contextual Batch Action Bar */}
      {selectedIds.length > 0 && savedView !== 'airtable' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-zinc-950 dark:bg-zinc-800 text-white">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono font-semibold tabular-nums">{selectedIds.length} selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-zinc-400 hover:text-white underline cursor-pointer"
            >
              Deselect
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void runBatchAction('mark_ready')}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 rounded transition-colors cursor-pointer"
            >
              Mark Ready
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void runBatchAction('mark_contacted')}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 rounded transition-colors cursor-pointer"
            >
              Mark Contacted
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void runBatchAction('snooze_3d')}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 rounded transition-colors cursor-pointer"
            >
              Snooze +3d
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void runBatchAction('disqualify')}
              className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-950/70 hover:bg-rose-900 rounded transition-colors cursor-pointer"
            >
              Disqualify
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {savedView === 'airtable' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Airtable CRM & Client View Mapping
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Neon PostgreSQL remains the source of truth for scoring and logs; Airtable mirrors client-facing pipeline status and care views.
              </p>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Airtable Field (SBA Prospects)</th>
                  <th className="py-2 pr-3 font-medium">Neon Source Column</th>
                  <th className="py-2 font-medium">Sync Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono text-zinc-700 dark:text-zinc-300">
                <tr>
                  <td className="py-2.5 pr-3">Dedupe ID (Merge Key)</td>
                  <td className="py-2.5 pr-3">sba_prospects.dedupe_id</td>
                  <td className="py-2.5">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3">Company Name / Track</td>
                  <td className="py-2.5 pr-3">borr_name / campaign_track</td>
                  <td className="py-2.5">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3">Lead Score</td>
                  <td className="py-2.5 pr-3">computed_lead_score</td>
                  <td className="py-2.5">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3">Outreach Status</td>
                  <td className="py-2.5 pr-3">outreach_status</td>
                  <td className="py-2.5">Make Inbound → Both</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3">Latest Outcome / Excerpt</td>
                  <td className="py-2.5 pr-3">v_sba_prospect_engagement</td>
                  <td className="py-2.5">Make Inbound → Both</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CodeCopyPanel
            title="Slack Block Kit Morning Digest Payload (#sba-outreach)"
            subtitle="Generated deterministically from Make Morning Queue scenario"
            code={JSON.stringify(slackDigest, null, 2)}
            maxHeightClass="max-h-80"
          />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {visibleRows.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  No operators match this queue filter.
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {hasActiveFilters
                    ? 'Adjust or clear your active filters to view available SBA prospects.'
                    : 'Import an SBA 7(a)/504 CSV export to score and populate the queue.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <th className="py-2.5 pl-4 pr-2 w-9">
                        <input
                          type="checkbox"
                          aria-label="Select all visible prospects"
                          checked={visibleRows.length > 0 && visibleRows.every((r) => selectedIds.includes(r.id))}
                          onChange={toggleAllVisible}
                          className="rounded border-zinc-300 dark:border-zinc-700 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Operator & Location</th>
                      <th className="py-2.5 px-3">Track / Status</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-right">Loan</th>
                      <th className="py-2.5 px-3 text-right">Reviews / Speed</th>
                      <th className="py-2.5 px-3">Primary Contact</th>
                      <th className="py-2.5 px-3">Friction Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                    {visibleRows.map((p, idx) => {
                      const isChecked = selectedIds.includes(p.id);
                      const isFocused = idx === focusedIndex;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setFocusedIndex(idx);
                            setActiveProspectId(p.id);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isFocused
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                          }`}
                        >
                          <td
                            className="py-3 pl-4 pr-2"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${p.borr_name}`}
                              checked={isChecked}
                              onChange={() => toggleRowSelect(p.id)}
                              className="rounded border-zinc-300 dark:border-zinc-700 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {p.borr_name}
                              {p.is_acquisition ? (
                                <span className="ml-1.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                                  [ACQ]
                                </span>
                              ) : null}
                            </div>
                            <div className="text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                              {p.borr_city}, {p.borr_state} · {p.program.toUpperCase()} · {p.total_touches} touches
                              {p.queue_bucket ? ` · ${p.queue_bucket}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono whitespace-nowrap">
                            <div className="text-zinc-700 dark:text-zinc-300">{p.campaign_track}</div>
                            <div className={`mt-0.5 font-medium ${statusTone(p.outreach_status)}`}>
                              {p.outreach_status}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                            <span
                              className={
                                p.computed_lead_score >= 80
                                  ? 'text-indigo-600 dark:text-indigo-400'
                                  : 'text-zinc-900 dark:text-zinc-100'
                              }
                            >
                              {p.computed_lead_score}
                            </span>
                            <span className="text-zinc-400 font-normal">/100</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                            ${Math.round(p.gross_approval).toLocaleString('en-US')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                            <div>{p.google_review_count} ({p.google_rating ?? '—'})</div>
                            <div className="text-[11px] text-zinc-500">
                              {p.response_time_ms ? `${p.response_time_ms}ms` : p.site_status}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                            <div className="truncate max-w-[180px]">{p.owner_name || 'Owner pending'}</div>
                            <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                              {p.best_email || p.best_phone || 'No direct contact'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 max-w-[220px] truncate" title={p.friction_tags}>
                            {p.friction_tags}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Outreach Activity */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Recent Outreach & Reply Log
              </h3>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                {touches.length} events
              </span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {touches.slice(0, 5).map((t) => {
                const prospect = prospects.find((p) => p.id === t.prospect_id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => prospect && setActiveProspectId(prospect.id)}
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-4 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {prospect?.borr_name || t.prospect_id}
                        <span className="text-zinc-400 mx-1.5">·</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">
                          {t.direction} / {t.channel}
                        </span>
                        <span className="text-zinc-400 mx-1.5">·</span>
                        <span
                          className={`font-mono ${
                            t.outcome.includes('interested')
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {t.outcome}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-1 truncate">
                        {t.reply_excerpt || t.message_summary}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0 tabular-nums">
                      {t.occurred_at.slice(0, 16).replace('T', ' ')} UTC
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Prospect Detail Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(activeProspect)}
        onClose={() => setActiveProspectId(null)}
        title={activeProspect?.borr_name || ''}
        subtitle={
          activeProspect
            ? `${activeProspect.borr_city}, ${activeProspect.borr_state} · ${activeProspect.naics_description} (${activeProspect.naics_code})`
            : ''
        }
        headerMeta={
          activeProspect
            ? `Score ${activeProspect.computed_lead_score}/100 · ${activeProspect.program.toUpperCase()} $${Math.round(
                activeProspect.gross_approval
              ).toLocaleString('en-US')} · Airtable ${activeProspect.airtable_record_id}`
            : ''
        }
        widthClass="max-w-2xl"
      >
        {activeProspect && (
          <div className="space-y-6">
            {/* Diagnostics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 text-xs">
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Website Status</div>
                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {activeProspect.site_status}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Load Speed</div>
                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {activeProspect.response_time_ms ? `${activeProspect.response_time_ms}ms` : 'No Site'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Google Reviews</div>
                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {activeProspect.google_review_count} ({activeProspect.google_rating ?? '—'}★)
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Instant Booking</div>
                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {activeProspect.has_booking_link ? 'Present' : 'Missing'}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                  {activeProspect.friction_tags}
                </span>
                {activeProspect.website_url && (
                  <a
                    href={activeProspect.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    <span>Open Site</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-500 dark:text-zinc-400">Recommended Coco Club Live Offer Fit</span>
                <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {activeProspect.gross_approval >= 1_100_000 || activeProspect.loan_count > 1
                    ? 'Tier 3 Portal Suite ($14.5k+ + $1,250/mo) / Tier 2 Anchor'
                    : activeProspect.site_status === 'HTTP_200' &&
                        activeProspect.has_form_or_intake &&
                        !activeProspect.missing_viewport_meta
                      ? 'Tier 1 Intake Sprint ($3,500 · 45d credit to Tier 2)'
                      : 'Tier 2 Full Revenue & Ops Engine ($7,500 + $650/mo)'}
                </span>
              </div>
            </div>

            {/* Inline CRM & Status Editor */}
            <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Neon & Airtable CRM Record
                </h3>
                <span className="font-mono text-[11px] text-zinc-400">dedupe: {activeProspect.dedupe_id}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Outreach Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Next Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={editFollowup}
                    onChange={(e) => setEditFollowup(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Owner Email
                  </label>
                  <input
                    type="email"
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Owner Phone
                  </label>
                  <input
                    type="text"
                    value={editOwnerPhone}
                    onChange={(e) => setEditOwnerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={savingProspect}
                    onClick={() => void handleSaveProspect()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{savingProspect ? 'Saving...' : 'Save CRM Changes'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Log New Outbound Touch */}
            <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Log Outbound Touch
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={touchChannel}
                  onChange={(e) =>
                    setTouchChannel(e.target.value as 'email' | 'phone_call' | 'voicemail' | 'linkedin')
                  }
                  className="px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                >
                  <option value="email">email</option>
                  <option value="phone_call">phone_call</option>
                  <option value="voicemail">voicemail</option>
                  <option value="linkedin">linkedin</option>
                </select>
                <input
                  type="text"
                  value={touchSubject}
                  onChange={(e) => setTouchSubject(e.target.value)}
                  placeholder="Subject or call topic"
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                />
              </div>
              <textarea
                rows={2}
                value={touchSummary}
                onChange={(e) => setTouchSummary(e.target.value)}
                placeholder="Note teardown Loom sent, gatekeeper name, or voicemail dropped..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
              <button
                type="button"
                disabled={loggingTouch}
                onClick={() => void handleLogTouch()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loggingTouch ? 'Logging...' : 'Log Touch & Schedule +3d Follow-Up'}</span>
              </button>
            </div>

            {/* Chronological Touch Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Touch & Inbound Reply History ({activeTouches.length})
                </h3>
              </div>
              {activeTouches.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No outreach touches recorded yet for this operator.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {activeTouches.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {t.channel === 'email' ? (
                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                          ) : t.channel === 'inbound_reply' ? (
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                          <span>
                            {t.direction} · {t.channel} · {t.outcome}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <Clock className="w-3 h-3" />
                          <span>{t.occurred_at.slice(0, 16).replace('T', ' ')} UTC</span>
                        </span>
                      </div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">{t.subject_line}</div>
                      <p className="text-zinc-600 dark:text-zinc-400">{t.reply_excerpt || t.message_summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {/* SBA CSV Filter & Dedupe Drawer */}
      <SlideOverDrawer
        open={csvImportOpen}
        onClose={onCloseCsvImport}
        title="SBA FOIA CSV Filter & SHA-256 Dedupe"
        subtitle="Deterministic qualification before Neon & Airtable upsert"
        widthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-1">
            <div className="font-medium text-zinc-900 dark:text-zinc-100">Deterministic Gate Rules</div>
            <div>• Approval window: 6–24 months old · Loan amount: $250,000–$2,500,000</div>
            <div>• Target states: GA, FL, TX, NC, TN · Excluded passive shells (HOLDINGS, REALTY, TRUST)</div>
            <div>• SHA-256 dedupe_id merges multi-loan 7(a) + 504 records cleanly</div>
          </div>
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={8}
            className="w-full font-mono text-xs p-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void handleRunProcess()}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {importing ? 'Filtering & Scoring...' : 'Filter & Upsert to Queue'}
            </button>
          </div>
          {importSummary && (
            <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
              {importSummary}
            </div>
          )}
        </div>
      </SlideOverDrawer>

      {/* Slack Morning Digest Drawer */}
      <SlideOverDrawer
        open={slackDrawerOpen}
        onClose={() => setSlackDrawerOpen(false)}
        title="Morning Slack Block Kit Digest"
        subtitle="Generated by Make 8:00 AM ET schedule (#sba-outreach)"
        widthClass="max-w-2xl"
      >
        <CodeCopyPanel
          title="Slack Block Kit Payload"
          subtitle="Copy into Make Slack module or verify daily formatting"
          code={JSON.stringify(slackDigest, null, 2)}
          maxHeightClass="max-h-[70vh]"
        />
      </SlideOverDrawer>
    </div>
  );
}
