import { useState, type FormEvent } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import type { MonthlyCareLog } from '../types';

interface CareMetricsViewProps {
  logs: MonthlyCareLog[];
  onRefresh: () => Promise<void>;
}

export function CareMetricsView({ logs, onRefresh }: CareMetricsViewProps) {
  const [clientSlug, setClientSlug] = useState('apex_hvac');
  const [careMonth, setCareMonth] = useState('2026-11-01');
  const [uptimePct, setUptimePct] = useState('99.96');
  const [wf1Runs, setWf1Runs] = useState('48');
  const [wf2Runs, setWf2Runs] = useState('36');
  const [wf3Runs, setWf3Runs] = useState('29');
  const [failedRuns, setFailedRuns] = useState('1');
  const [tweaksCount, setTweaksCount] = useState('2');
  const [tweaksSummary, setTweaksSummary] = useState(
    'Updated booking reminder lead time from 24h to 18h; clarified service-area copy on /quote'
  );
  const [changeOrdersCount, setChangeOrdersCount] = useState('0');
  const [changeOrderRevenue, setChangeOrderRevenue] = useState('0');
  const [saving, setSaving] = useState(false);
  const [rollingUp, setRollingUp] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/care-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_slug: clientSlug,
          care_month: careMonth,
          site_uptime_pct: Number(uptimePct),
          wf1_lead_runs: Number(wf1Runs),
          wf2_booking_runs: Number(wf2Runs),
          wf3_followup_runs: Number(wf3Runs),
          failed_runs_count: Number(failedRuns),
          care_tweaks_count: Number(tweaksCount),
          care_tweaks_summary: tweaksSummary,
          change_orders_count: Number(changeOrdersCount),
          change_order_revenue: Number(changeOrderRevenue),
        }),
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleRollupFromRuns = async () => {
    setRollingUp(true);
    try {
      await fetch('/api/care-logs/rollup', { method: 'POST' });
      await onRefresh();
    } finally {
      setRollingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tier 2 Monthly Care Logs ($650/mo Retainer Ledger)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              One row per client + month · ON CONFLICT (client_slug, care_month) DO UPDATE preserves uptime, care tweaks, and change orders.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRollupFromRuns}
            disabled={rollingUp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rollingUp ? 'animate-spin' : ''}`} />
            <span>Roll Up from automation_runs</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Client Slug</th>
                <th className="py-2.5 px-4">Month</th>
                <th className="py-2.5 px-4 text-right">Uptime</th>
                <th className="py-2.5 px-4 text-right">WF1 / WF2 / WF3</th>
                <th className="py-2.5 px-4 text-right">Total Runs</th>
                <th className="py-2.5 px-4 text-right">Failed</th>
                <th className="py-2.5 px-4 text-right">Tweaks</th>
                <th className="py-2.5 px-4 text-right">Change Orders</th>
                <th className="py-2.5 px-4">Top Error / Care Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{log.client_slug}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{log.care_month}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                    {Number(log.site_uptime_pct).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {log.wf1_lead_runs} / {log.wf2_booking_runs} / {log.wf3_followup_runs}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                    {log.total_workflow_runs}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums ${
                      log.failed_runs_count > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {log.failed_runs_count} ({log.dropped_or_retried_count} retried)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{log.care_tweaks_count}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {log.change_orders_count} (${Number(log.change_order_revenue).toLocaleString('en-US')})
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    <div className="truncate font-medium text-slate-700">{log.top_error_summary}</div>
                    <div className="truncate text-slate-500 mt-0.5">{log.care_tweaks_summary}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Upsert Monthly Client Care Record</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mirrors to Neon tier2_monthly_care_logs and Airtable Tier 2 Care Logs view.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Client Slug</label>
            <input
              type="text"
              value={clientSlug}
              onChange={(e) => setClientSlug(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Care Month (YYYY-MM-01)</label>
            <input
              type="text"
              value={careMonth}
              onChange={(e) => setCareMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Uptime %</label>
            <input
              type="number"
              step="0.01"
              value={uptimePct}
              onChange={(e) => setUptimePct(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Failed Runs</label>
            <input
              type="number"
              value={failedRuns}
              onChange={(e) => setFailedRuns(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">WF1 Lead Runs</label>
            <input
              type="number"
              value={wf1Runs}
              onChange={(e) => setWf1Runs(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">WF2 Booking Runs</label>
            <input
              type="number"
              value={wf2Runs}
              onChange={(e) => setWf2Runs(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">WF3 Follow-Up Runs</label>
            <input
              type="number"
              value={wf3Runs}
              onChange={(e) => setWf3Runs(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Care Tweaks Count</label>
            <input
              type="number"
              value={tweaksCount}
              onChange={(e) => setTweaksCount(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Change Orders Count</label>
            <input
              type="number"
              value={changeOrdersCount}
              onChange={(e) => setChangeOrdersCount(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Change Order Revenue ($)</label>
            <input
              type="number"
              step="0.01"
              value={changeOrderRevenue}
              onChange={(e) => setChangeOrderRevenue(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Care Tweaks Summary</label>
            <input
              type="text"
              value={tweaksSummary}
              onChange={(e) => setTweaksSummary(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Upsert Care Log'}</span>
        </button>
      </form>
    </div>
  );
}
