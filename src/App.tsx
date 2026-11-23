import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import type {
  AutomationRun,
  BlueprintsBundle,
  MonthlyCareLog,
  NavTab,
  OutreachTouch,
  OverviewResponse,
  Prospect,
  TierSpec,
  WorkflowRunSummary,
} from './types';
import { DashboardShell } from './components/DashboardShell';
import { QueueLeadsView } from './components/QueueLeadsView';
import { WebhookMakeView } from './components/WebhookMakeView';
import { RunLogsNeonView } from './components/RunLogsNeonView';
import { CareMetricsView } from './components/CareMetricsView';
import { ScopeTriageView } from './components/ScopeTriageView';
import { ProspectingAgentView } from './components/ProspectingAgentView';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('queue');
  const [darkMode, setDarkMode] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [externalSelectedProspectId, setExternalSelectedProspectId] = useState<string | null>(null);
  const [agentTargetProspectId, setAgentTargetProspectId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [touches, setTouches] = useState<OutreachTouch[]>([]);
  const [dueNudges, setDueNudges] = useState<Prospect[]>([]);
  const [freshHighScore, setFreshHighScore] = useState<Prospect[]>([]);
  const [slackDigest, setSlackDigest] = useState<unknown>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runSummary, setRunSummary] = useState<WorkflowRunSummary[]>([]);
  const [careLogs, setCareLogs] = useState<MonthlyCareLog[]>([]);
  const [tiers, setTiers] = useState<TierSpec[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintsBundle | null>(null);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 3200);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [ovRes, prRes, qRes, rRes, cRes, bpRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/prospects'),
        fetch('/api/queue'),
        fetch('/api/runs'),
        fetch('/api/care-logs'),
        fetch('/api/blueprints'),
      ]);

      if (!ovRes.ok || !prRes.ok || !qRes.ok || !rRes.ok || !cRes.ok || !bpRes.ok) {
        throw new Error('Failed to load operational console data');
      }

      const [ov, pr, q, r, c, bp] = await Promise.all([
        ovRes.json(),
        prRes.json(),
        qRes.json(),
        rRes.json(),
        cRes.json(),
        bpRes.json(),
      ]);

      setOverview(ov);
      setProspects(pr.prospects || []);
      setTouches(pr.touches || []);
      setDueNudges(q.dueNudges || []);
      setFreshHighScore(q.freshHighScore || []);
      setSlackDigest(q.slackPayload || null);
      setRuns(r.runs || []);
      setRunSummary(r.summary || []);
      setCareLogs(c.logs || []);
      setTiers(c.tiers || []);
      setBlueprints(bp);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleGlobalSimulateError = useCallback(async () => {
    const res = await fetch('/api/runs/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'error',
        client_slug: 'apex_hvac',
        workflow_name: 'wf2_booking_reminders',
        failed_node: 'HTTP — Calendar Webhook',
        error_message: 'Request timeout after 8000ms calling booking endpoint',
      }),
    });
    if (res.ok) {
      showToast('Simulated Make scenario failure · logged to automation_runs', 'error');
      setActiveTab('runs');
      await fetchAll();
    }
  }, [fetchAll, showToast]);

  const handleGlobalRollupCare = useCallback(async () => {
    const res = await fetch('/api/care-logs/rollup', { method: 'POST' });
    if (res.ok) {
      showToast('Rolled up automation_runs into monthly client care logs');
      setActiveTab('care');
      await fetchAll();
    }
  }, [fetchAll, showToast]);

  const errorRunCount = runs.filter((r) => ['error', 'failed', 'timeout', 'rejected'].includes(r.status)).length;
  const queueCount = dueNudges.length + freshHighScore.length;

  return (
    <>
      <DashboardShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        overview={overview}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        refreshing={refreshing}
        onRefresh={() => void fetchAll()}
        onOpenCommandPalette={() => setCmdOpen(true)}
        onOpenCsvImport={() => setCsvImportOpen(true)}
        queueCount={queueCount}
        errorRunCount={errorRunCount}
      >
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-3.5 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-5 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 h-24 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
              <div className="lg:col-span-4 h-24 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
              <div className="lg:col-span-3 h-24 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
            </div>
            <div className="h-10 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-80 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
          </div>
        ) : (
          <>
            {activeTab === 'agent' && (
              <ProspectingAgentView
                prospects={prospects}
                tiers={tiers}
                externalProspectId={agentTargetProspectId}
                onClearExternalProspect={() => setAgentTargetProspectId(null)}
                onRefresh={fetchAll}
                onOpenInQueue={(id) => {
                  setActiveTab('queue');
                  setExternalSelectedProspectId(id);
                }}
                onToast={showToast}
              />
            )}
            {activeTab === 'queue' && (
              <QueueLeadsView
                overview={overview}
                prospects={prospects}
                touches={touches}
                dueNudges={dueNudges}
                freshHighScore={freshHighScore}
                slackDigest={slackDigest}
                csvImportOpen={csvImportOpen}
                onCloseCsvImport={() => setCsvImportOpen(false)}
                onOpenCsvImport={() => setCsvImportOpen(true)}
                externalSelectedProspectId={externalSelectedProspectId}
                onClearExternalSelectedProspect={() => setExternalSelectedProspectId(null)}
                onLaunchAgentForProspect={(id) => {
                  setAgentTargetProspectId(id);
                  setActiveTab('agent');
                }}
                onRefresh={fetchAll}
                onToast={showToast}
              />
            )}
            {activeTab === 'webhook' && (
              <WebhookMakeView blueprints={blueprints} onRefresh={fetchAll} onToast={showToast} />
            )}
            {activeTab === 'runs' && (
              <RunLogsNeonView
                overview={overview}
                runs={runs}
                summary={runSummary}
                blueprints={blueprints}
                onRefresh={fetchAll}
                onToast={showToast}
              />
            )}
            {activeTab === 'care' && (
              <CareMetricsView logs={careLogs} tiers={tiers} onRefresh={fetchAll} onToast={showToast} />
            )}
            {activeTab === 'triage' && <ScopeTriageView />}
          </>
        )}
      </DashboardShell>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        prospects={prospects}
        darkMode={darkMode}
        onSelectTab={(tab) => setActiveTab(tab)}
        onSelectProspect={(id) => {
          setActiveTab('queue');
          setExternalSelectedProspectId(id);
        }}
        onSimulateError={handleGlobalSimulateError}
        onRollupCare={handleGlobalRollupCare}
        onToggleDark={() => setDarkMode((d) => !d)}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-lg border text-xs font-medium ${
            toast.tone === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200'
          }`}
        >
          {toast.tone === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
