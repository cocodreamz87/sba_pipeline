import { useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import type { AutomationRun, WorkflowRunSummary, BlueprintsBundle } from '../types';
import { CodeCopyPanel } from './CodeCopyPanel';

interface RunLogsNeonViewProps {
  runs: AutomationRun[];
  summary: WorkflowRunSummary[];
  blueprints: BlueprintsBundle | null;
  onRefresh: () => Promise<void>;
}

export function RunLogsNeonView({ runs, summary, blueprints, onRefresh }: RunLogsNeonViewProps) {
  const [simClient, setSimClient] = useState('apex_hvac');
  const [simWorkflow, setSimWorkflow] = useState('wf2_booking_reminders');
  const [simError, setSimError] = useState('Request timeout after 8000ms calling booking endpoint');
  const [slackPreview, setSlackPreview] = useState<string | null>(null);
  const [selectedSql, setSelectedSql] = useState<'master' | 'care' | 'rollup' | 'queue' | 'errors'>('master');
  const [running, setRunning] = useState(false);

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
      if (data.slackPayload) {
        setSlackPreview(JSON.stringify(data.slackPayload, null, 2));
      } else {
        setSlackPreview(null);
      }
      await onRefresh();
    } finally {
      setRunning(false);
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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Make Error Watcher & Execution Simulator
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Simulates Make Error Handler normalization (client_slug | workflow_name, timeout detection) → Neon automation_runs → Slack #ops-alerts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSimulate('success')}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Log Success Run</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulate('error')}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulate Make Failure</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Client Slug</label>
            <input
              type="text"
              value={simClient}
              onChange={(e) => setSimClient(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Make Workflow Name</label>
            <select
              value={simWorkflow}
              onChange={(e) => setSimWorkflow(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
            >
              <option value="wf1_lead_routing">wf1_lead_routing</option>
              <option value="wf2_booking_reminders">wf2_booking_reminders</option>
              <option value="wf3_followup_loop">wf3_followup_loop</option>
              <option value="wf1_inbound_reply_logger">wf1_inbound_reply_logger</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Error Message</label>
            <input
              type="text"
              value={simError}
              onChange={(e) => setSimError(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
            />
          </div>
        </div>

        {slackPreview && (
          <CodeCopyPanel
            title="Immediate Slack #ops-alerts Block Kit Payload"
            subtitle="Emitted by Make Error Watcher Scenario"
            code={slackPreview}
            maxHeightClass="max-h-56"
          />
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Workflow Error Rate Summary (Single-Pass FILTER Aggregation)
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">{summary.length} scenarios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Workflow / Scenario</th>
                <th className="py-2.5 px-4 text-right">Runs</th>
                <th className="py-2.5 px-4 text-right">Success</th>
                <th className="py-2.5 px-4 text-right">Errors</th>
                <th className="py-2.5 px-4 text-right">Error %</th>
                <th className="py-2.5 px-4 text-right">Avg Duration</th>
                <th className="py-2.5 px-4">Latest Error Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {summary.map((row) => (
                <tr key={row.workflow_name} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{row.workflow_name}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{row.total_runs}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700 tabular-nums">
                    {row.success_runs}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                      row.error_count > 0 ? 'text-red-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {row.error_count}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{row.error_rate_pct}%</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                    {row.avg_duration_ms}ms
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-md truncate">{row.latest_error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent Make Execution Logs (automation_runs)</h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">{runs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Execution ID</th>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Scenario / Module</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Error Detail</th>
                <th className="py-2.5 px-4 text-right">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {runs.slice(0, 15).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{r.execution_id}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-900 whitespace-nowrap">{r.client_slug}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-mono text-slate-900">{r.workflow_name}</div>
                    {r.failed_node && <div className="text-slate-500 mt-0.5">{r.failed_node}</div>}
                  </td>
                  <td className="py-2.5 px-4 font-mono whitespace-nowrap">
                    <span
                      className={
                        ['success', 'ok', 'completed'].includes(r.status)
                          ? 'text-emerald-700 font-medium'
                          : r.status === 'timeout'
                            ? 'text-amber-700 font-medium'
                            : 'text-red-700 font-medium'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-sm truncate">{r.error_message || '—'}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500 whitespace-nowrap tabular-nums">
                    {r.created_at.slice(0, 19).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              ['master', 'Master Schema (sba_prospects.sql)'],
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
                selectedSql === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <CodeCopyPanel title={sqlDoc.title} subtitle={sqlDoc.subtitle} code={sqlDoc.code} maxHeightClass="max-h-[420px]" />
      </div>
    </div>
  );
}
