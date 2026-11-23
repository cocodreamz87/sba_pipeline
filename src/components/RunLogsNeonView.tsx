import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Play, RotateCcw } from 'lucide-react';
import type { AutomationRun, BlueprintsBundle, OverviewResponse, WorkflowRunSummary } from '../types';
import { Sparkline, UptimeTracker } from './MicroCharts';
import { SlideOverDrawer } from './SlideOverDrawer';
import { CodeCopyPanel } from './CodeCopyPanel';

interface RunLogsNeonViewProps {
  overview: OverviewResponse | null;
  runs: AutomationRun[];
  summary: WorkflowRunSummary[];
  blueprints: BlueprintsBundle | null;
  onRefresh: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error') => void;
}

export function RunLogsNeonView({
  overview,
  runs,
  summary,
  blueprints,
  onRefresh,
  onToast,
}: RunLogsNeonViewProps) {
  const [subTab, setSubTab] = useState<'live' | 'sql'>('live');
  const [selectedSql, setSelectedSql] = useState<'master' | 'care' | 'rollup' | 'queue' | 'errors'>('master');
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const [simOpen, setSimOpen] = useState(false);
  const [simClient, setSimClient] = useState('apex_hvac');
  const [simWorkflow, setSimWorkflow] = useState('wf2_booking_reminders');
  const [simError, setSimError] = useState('Request timeout after 8000ms calling booking endpoint');
  const [running, setRunning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleSimulate = async (mode: 'error' | 'success') => {
    setRunning(true);
    try {
      const res = await fetch('/api/runs/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          client_slug: simClient,
          workflow_name: simWorkflow,
          failed_node: 'HTTP — Calendar Webhook',
          error_message: simError,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast(
          mode === 'error'
            ? `Logged Make failure for ${simClient} · Slack #ops-alerts preview ready`
            : `Logged nominal run for ${simClient}`,
          mode === 'error' ? 'error' : 'success'
        );
        if (data.run) setSelectedRun(data.run);
        setSimOpen(false);
        await onRefresh();
      }
    } finally {
      setRunning(false);
    }
  };

  const handleRetryRun = async (runId: string) => {
    setRetryingId(runId);
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        onToast(`Replayed scenario cleanly (${data.run?.execution_id})`);
        setSelectedRun(data.run || null);
        await onRefresh();
      } else {
        onToast(data.error || 'Retry failed', 'error');
      }
    } finally {
      setRetryingId(null);
    }
  };

  const activeSql = () => {
    if (!blueprints) return { title: 'Loading...', subtitle: '', code: '' };
    if (selectedSql === 'master') {
      return {
        title: 'sba_prospects.sql',
        subtitle: 'Neon PostgreSQL master DDL: prospects, sba_outreach_touches, automation_runs, v_sba_prospect_engagement',
        code: blueprints.sql.masterSchema,
      };
    }
    if (selectedSql === 'care') {
      return {
        title: 'sba-care-metrics-schema.sql',
        subtitle: 'Neon PostgreSQL DDL: tier2_monthly_care_logs + generated total_workflow_runs',
        code: blueprints.sql.careMetricsSchema,
      };
    }
    if (selectedSql === 'rollup') {
      return {
        title: 'sba-monthly-care-upsert.sql',
        subtitle: 'Deterministic monthly rollup: COUNT(*) FILTER (WHERE ...) + ON CONFLICT DO UPDATE',
        code: blueprints.sql.careRollupUpsert,
      };
    }
    if (selectedSql === 'queue') {
      return {
        title: 'sba-daily-queue-queries.sql',
        subtitle: 'Daily outbound queue queries (America/New_York due boundary)',
        code: blueprints.sql.dailyQueueQueries,
      };
    }
    return {
      title: 'sba-run-error-queries.sql',
      subtitle: 'Make automation_runs & sba_outreach_touches error aggregation queries',
      code: blueprints.sql.runErrorQueries,
    };
  };

  const sqlDoc = activeSql();
  const isFailure = (status: string) => ['error', 'failed', 'timeout', 'rejected'].includes(status.toLowerCase());

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Simulator Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('live')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'live'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Live Executions & Health ({runs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('sql')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'sql'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Neon SQL Reference (5 files)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSimOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{simOpen ? 'Hide Error Simulator' : 'Simulate Make Run'}</span>
        </button>
      </div>

      {simOpen && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Make Error Watcher & Execution Simulator
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Normalizes Make scenario errors → Neon automation_runs → Slack #ops-alerts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSimulate('success')}
                disabled={running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Log Success</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSimulate('error')}
                disabled={running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Failure</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={simClient}
              onChange={(e) => setSimClient(e.target.value)}
              placeholder="Client slug"
              className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
            <select
              value={simWorkflow}
              onChange={(e) => setSimWorkflow(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            >
              <option value="wf1_lead_routing">wf1_lead_routing</option>
              <option value="wf2_booking_reminders">wf2_booking_reminders</option>
              <option value="wf3_followup_loop">wf3_followup_loop</option>
              <option value="wf1_inbound_reply_logger">wf1_inbound_reply_logger</option>
            </select>
            <input
              type="text"
              value={simError}
              onChange={(e) => setSimError(e.target.value)}
              placeholder="Error message"
              className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>
        </div>
      )}

      {subTab === 'live' ? (
        <div className="space-y-5">
          {/* Top Health & Uptime Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Make Scenario Reliability (14 Days)
                </h3>
                <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                  {overview?.metrics.errorRatePct ?? 0}% error rate · {runs.length} runs logged
                </span>
              </div>
              {overview?.trends?.uptimeSegments && <UptimeTracker segments={overview.trends.uptimeSegments} />}
            </div>

            <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Execution Volume
                </div>
                <div className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 mt-1 tabular-nums">
                  {overview?.metrics.totalRunsLogged ?? runs.length}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Single-pass Neon FILTER rollup
                </div>
              </div>
              {overview?.trends?.runs14d && (
                <Sparkline data={overview.trends.runs14d} color="#059669" height={34} width={104} />
              )}
            </div>
          </div>

          {/* Workflow Health Table with Inline Error-Rate Progress Bars */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Scenario Health Breakdown
              </h3>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                {summary.length} scenarios
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <th className="py-2.5 px-4">Scenario</th>
                    <th className="py-2.5 px-4 text-right">Runs</th>
                    <th className="py-2.5 px-4 text-right">Errors</th>
                    <th className="py-2.5 px-4 w-44">Error Rate</th>
                    <th className="py-2.5 px-4 text-right">Avg Latency</th>
                    <th className="py-2.5 px-4">Latest Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                  {summary.map((row) => (
                    <tr key={row.workflow_name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {row.workflow_name}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        {row.total_runs}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                          row.error_count > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-500'
                        }`}
                      >
                        {row.error_count}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.error_rate_pct > 20
                                  ? 'bg-rose-500'
                                  : row.error_rate_pct > 0
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(row.error_rate_pct > 0 ? 8 : 100, Math.min(100, row.error_rate_pct))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {row.error_rate_pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {row.avg_duration_ms}ms
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 max-w-sm truncate">
                        {row.latest_error_message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clickable Recent Execution Rows */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Execution Stream (automation_runs · click row for detail & replay)
              </h3>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                {runs.length} entries
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <th className="py-2.5 px-4">Execution ID</th>
                    <th className="py-2.5 px-4">Client</th>
                    <th className="py-2.5 px-4">Scenario / Failed Module</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Error Detail</th>
                    <th className="py-2.5 px-4 text-right">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                  {runs.slice(0, 18).map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRun(r)}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {r.execution_id}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        {r.client_slug}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-mono text-zinc-900 dark:text-zinc-100">{r.workflow_name}</div>
                        {r.failed_node && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{r.failed_node}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono whitespace-nowrap">
                        <span
                          className={
                            ['success', 'ok', 'completed'].includes(r.status)
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : r.status === 'timeout'
                                ? 'text-amber-700 dark:text-amber-400 font-medium'
                                : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 max-w-sm truncate">
                        {r.error_message || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                        {r.created_at.slice(0, 19).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg w-fit">
            {(
              [
                ['master', 'sba_prospects.sql'],
                ['care', 'Care Metrics DDL'],
                ['rollup', 'Monthly Care Upsert'],
                ['queue', 'Daily Queue SQL'],
                ['errors', 'Run & Error Queries'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedSql(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSql === key
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <CodeCopyPanel title={sqlDoc.title} subtitle={sqlDoc.subtitle} code={sqlDoc.code} maxHeightClass="max-h-[520px]" />
        </div>
      )}

      {/* Run Detail Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={selectedRun?.workflow_name || ''}
        subtitle={selectedRun ? `Client: ${selectedRun.client_slug} · Run ID: ${selectedRun.execution_id}` : ''}
        headerMeta={
          selectedRun
            ? `${selectedRun.status.toUpperCase()} · ${selectedRun.duration_ms}ms · ${selectedRun.created_at.slice(0, 19).replace('T', ' ')} UTC`
            : ''
        }
        widthClass="max-w-xl"
        footer={
          selectedRun && (
            <div className="flex items-center justify-between gap-3">
              <a
                href={selectedRun.execution_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              >
                <span>Open in Make</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                disabled={retryingId === selectedRun.id}
                onClick={() => void handleRetryRun(selectedRun.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{retryingId === selectedRun.id ? 'Replaying...' : 'Replay Scenario Run'}</span>
              </button>
            </div>
          )
        }
      >
        {selectedRun && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 text-xs">
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Status</div>
                <div
                  className={`font-mono font-semibold mt-0.5 ${
                    isFailure(selectedRun.status)
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {selectedRun.status}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Records Processed</div>
                <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {selectedRun.records_processed}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Workflow ID</div>
                <div className="font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">{selectedRun.workflow_id}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Failed Module</div>
                <div className="font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">
                  {selectedRun.failed_node || 'None'}
                </div>
              </div>
            </div>

            {selectedRun.error_message && (
              <div className="p-3.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 font-mono">
                {selectedRun.error_message}
              </div>
            )}

            <CodeCopyPanel
              title="Slack #ops-alerts Notification Payload"
              subtitle="Deterministic alert generated by Make Error Watcher"
              code={JSON.stringify(
                {
                  channel: '#ops-alerts',
                  text: `[${selectedRun.client_slug}] ${selectedRun.workflow_name} — ${selectedRun.status}`,
                  failed_node: selectedRun.failed_node || 'none',
                  error: selectedRun.error_message || 'none',
                  execution_url: selectedRun.execution_url,
                },
                null,
                2
              )}
              maxHeightClass="max-h-60"
            />
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
