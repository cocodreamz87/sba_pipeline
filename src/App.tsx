import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Layers,
  RefreshCw,
  Scale,
  ShieldAlert,
  Webhook,
} from 'lucide-react';
import type {
  AutomationRun,
  BlueprintsBundle,
  MonthlyCareLog,
  NavTab,
  OutreachTouch,
  OverviewResponse,
  Prospect,
  WorkflowRunSummary,
} from './types';
import { QueueLeadsView } from './components/QueueLeadsView';
import { WebhookMakeView } from './components/WebhookMakeView';
import { RunLogsNeonView } from './components/RunLogsNeonView';
import { CareMetricsView } from './components/CareMetricsView';
import { ScopeTriageView } from './components/ScopeTriageView';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Layers }[] = [
  { id: 'queue', label: 'Daily Queue & Leads', icon: Layers },
  { id: 'webhook', label: 'Webhook & Make', icon: Webhook },
  { id: 'runs', label: 'Run Logs & Neon SQL', icon: Database },
  { id: 'care', label: 'Tier 2 Care ($650/mo)', icon: Activity },
  { id: 'triage', label: 'Scope & Change Orders', icon: Scale },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('queue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [touches, setTouches] = useState<OutreachTouch[]>([]);
  const [dueNudges, setDueNudges] = useState<Prospect[]>([]);
  const [freshHighScore, setFreshHighScore] = useState<Prospect[]>([]);
  const [slackDigest, setSlackDigest] = useState<unknown>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runSummary, setRunSummary] = useState<WorkflowRunSummary[]>([]);
  const [careLogs, setCareLogs] = useState<MonthlyCareLog[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintsBundle | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
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
      setBlueprints(bp);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
            SBA Lead Ops
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Coco Club Live · Tier 2 Care
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <div className="font-semibold text-slate-700">Active Stack</div>
          <div>Orchestration: Make</div>
          <div>Database: Neon PostgreSQL</div>
          <div>CRM & Views: Airtable</div>
          <div>Ingress: CF Worker (Secret Gate)</div>
          <div>Alerts: Slack</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-medium text-slate-900 whitespace-nowrap">Operations</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{activeNav.label}</span>
            {overview && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-600 whitespace-nowrap">
                  {overview.storageMode === 'neon_postgres' ? 'Neon Connected' : 'In-Memory Store'}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {overview && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Qualified Operators</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {overview.metrics.qualifiedProspects}
                </div>
                <div className="text-xs text-slate-500 mt-1">7(a) + 504 deduped</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Daily Queue Ready</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {overview.metrics.dueFollowUps + overview.metrics.highScoreReady}
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {overview.metrics.dueFollowUps} due · {overview.metrics.highScoreReady} new 60+
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Make Scenario Runs</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {overview.metrics.totalRunsLogged}
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {overview.metrics.errorRatePct}% error rate
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Tier 2 Care MRR</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  ${overview.metrics.activeCareMrr.toLocaleString('en-US')}
                </div>
                <div className="text-xs text-slate-500 mt-1">$650/mo per client</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Change Orders</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  ${overview.metrics.changeOrderRevenue.toLocaleString('en-US')}
                </div>
                <div className="text-xs text-slate-500 mt-1">Billed separately</div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-xs text-red-800">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              Loading SBA pipeline operations data...
            </div>
          ) : (
            <>
              {activeTab === 'queue' && (
                <QueueLeadsView
                  prospects={prospects}
                  touches={touches}
                  dueNudges={dueNudges}
                  freshHighScore={freshHighScore}
                  slackDigest={slackDigest}
                  onRefresh={fetchAll}
                />
              )}
              {activeTab === 'webhook' && (
                <WebhookMakeView blueprints={blueprints} onRefresh={fetchAll} />
              )}
              {activeTab === 'runs' && (
                <RunLogsNeonView
                  runs={runs}
                  summary={runSummary}
                  blueprints={blueprints}
                  onRefresh={fetchAll}
                />
              )}
              {activeTab === 'care' && (
                <CareMetricsView logs={careLogs} onRefresh={fetchAll} />
              )}
              {activeTab === 'triage' && <ScopeTriageView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
