import { useMemo, useState, type FormEvent } from 'react';
import { Calculator, FileText, Pencil, Plus, RefreshCw, Save } from 'lucide-react';
import type { MonthlyCareLog, ServiceTier, TierSpec } from '../types';
import { SlideOverDrawer } from './SlideOverDrawer';
import { CodeCopyPanel } from './CodeCopyPanel';

interface CareMetricsViewProps {
  logs: MonthlyCareLog[];
  tiers: TierSpec[];
  onRefresh: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error') => void;
}

const DEFAULT_TIERS: TierSpec[] = [
  {
    id: 'tier1',
    name: 'Tier 1: Conversion & Intake Sprint',
    shortLabel: 'Tier 1 Sprint',
    tagline: 'Stop losing warm mobile traffic and cut response time under 60s without a full rebuild.',
    setupFee: 3500,
    monthlyFee: 0,
    turnaround: '10 business days',
    paymentTerms: '50% upfront ($1,750) / 50% at launch ($1,750)',
    webScope: 'Conversion landing/intake funnel + mobile UX overhaul (up to 3 core views)',
    automationLimitLabel: '1 core pipeline',
    includedWorkflows: 1,
    includedHours: 0,
    supportWindow: '14-day post-launch bug coverage · 45-day 100% upgrade credit toward Tier 2',
  },
  {
    id: 'tier2',
    name: 'Tier 2: Full Revenue & Ops Engine',
    shortLabel: 'Tier 2 Core',
    tagline: 'Replace a static site with high-converting UX wired into automated booking, follow-up & reviews.',
    setupFee: 7500,
    monthlyFee: 650,
    turnaround: '3 to 4 weeks',
    paymentTerms: '30% deposit ($2,250) / 40% staging ($3,000) / 30% launch ($2,250)',
    webScope: 'Custom dark/light studio marketing site (up to 7 pages) + conversion architecture',
    automationLimitLabel: 'Up to 3 core pipelines',
    includedWorkflows: 3,
    includedHours: 2,
    supportWindow: '$650/mo Care (3-mo min) · Uptime/webhook alerts + up to 2 hrs/mo tweaks',
  },
  {
    id: 'tier3',
    name: 'Tier 3: Custom Operations & Portal Suite',
    shortLabel: 'Tier 3 Suite',
    tagline: 'Eliminate manual admin across quoting, client portals, ERP/Stripe sync & billing.',
    setupFee: 14500,
    monthlyFee: 1250,
    turnaround: '6 to 8 weeks',
    paymentTerms: '30% deposit ($4,350) / 40% milestone ($5,800) / 30% launch ($4,350)',
    webScope: 'Custom web platform + authenticated client status/booking/invoice portal',
    automationLimitLabel: 'Unlimited deterministic workflows',
    includedWorkflows: 99,
    includedHours: 5,
    supportWindow: '$1,250/mo Engineering Retainer · Priority SLA, DB backups & 5 hrs/mo expansion',
  },
];

export function CareMetricsView({ logs, tiers, onRefresh, onToast }: CareMetricsViewProps) {
  const tierCatalog = tiers.length > 0 ? tiers : DEFAULT_TIERS;

  const [tierFilter, setTierFilter] = useState<'all' | ServiceTier>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [roiDrawerOpen, setRoiDrawerOpen] = useState(false);
  const [recapLog, setRecapLog] = useState<MonthlyCareLog | null>(null);

  // Editor form states
  const [clientSlug, setClientSlug] = useState('apex_hvac');
  const [serviceTier, setServiceTier] = useState<ServiceTier>('tier2');
  const [setupFee, setSetupFee] = useState('7500');
  const [monthlyRetainer, setMonthlyRetainer] = useState('650');
  const [includedHours, setIncludedHours] = useState('2');
  const [hoursUsed, setHoursUsed] = useState('1.5');
  const [upgradeExpires, setUpgradeExpires] = useState('2026-12-28');
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

  // ROI Calculator states
  const [avgDealValue, setAvgDealValue] = useState('3000');
  const [closeRatePct, setCloseRatePct] = useState('40');
  const [recoveredLeads, setRecoveredLeads] = useState('3');

  const totals = useMemo(() => {
    const mrr = logs.reduce((s, l) => s + Number(l.monthly_retainer_fee || 0), 0);
    const setupTotal = logs.reduce((s, l) => s + Number(l.setup_fee || 0), 0);
    const totalRuns = logs.reduce((s, l) => s + Number(l.total_workflow_runs || 0), 0);
    const coRev = logs.reduce((s, l) => s + Number(l.change_order_revenue || 0), 0);
    const avgUptime =
      logs.length > 0
        ? (logs.reduce((s, l) => s + Number(l.site_uptime_pct || 0), 0) / logs.length).toFixed(2)
        : '100.00';
    return { mrr, setupTotal, totalRuns, coRev, avgUptime };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (tierFilter === 'all') return logs;
    return logs.filter((l) => l.service_tier === tierFilter);
  }, [logs, tierFilter]);

  const applyTierDefaults = (nextTier: ServiceTier) => {
    setServiceTier(nextTier);
    const spec = tierCatalog.find((t) => t.id === nextTier);
    if (spec) {
      setSetupFee(String(spec.setupFee));
      setMonthlyRetainer(String(spec.monthlyFee));
      setIncludedHours(String(spec.includedHours));
    }
  };

  const openEditDrawer = (log?: MonthlyCareLog) => {
    if (log) {
      setClientSlug(log.client_slug);
      setServiceTier(log.service_tier || 'tier2');
      setSetupFee(String(log.setup_fee ?? 7500));
      setMonthlyRetainer(String(log.monthly_retainer_fee ?? 650));
      setIncludedHours(String(log.included_hours ?? 2));
      setHoursUsed(String(log.care_hours_used ?? 0));
      setUpgradeExpires(log.upgrade_credit_expires_at || '2026-12-28');
      setCareMonth(log.care_month);
      setUptimePct(String(log.site_uptime_pct));
      setWf1Runs(String(log.wf1_lead_runs));
      setWf2Runs(String(log.wf2_booking_runs));
      setWf3Runs(String(log.wf3_followup_runs));
      setFailedRuns(String(log.failed_runs_count));
      setTweaksCount(String(log.care_tweaks_count));
      setTweaksSummary(log.care_tweaks_summary);
      setChangeOrdersCount(String(log.change_orders_count));
      setChangeOrderRevenue(String(log.change_order_revenue));
    } else {
      setClientSlug('');
      applyTierDefaults('tier2');
      setHoursUsed('0');
      setCareMonth('2026-11-01');
      setUptimePct('99.98');
      setWf1Runs('0');
      setWf2Runs('0');
      setWf3Runs('0');
      setFailedRuns('0');
      setTweaksCount('0');
      setTweaksSummary('Routine health check & monitoring');
      setChangeOrdersCount('0');
      setChangeOrderRevenue('0');
    }
    setEditorOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/care-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_slug: clientSlug || 'new_client',
          service_tier: serviceTier,
          setup_fee: Number(setupFee),
          monthly_retainer_fee: Number(monthlyRetainer),
          included_hours: Number(includedHours),
          care_hours_used: Number(hoursUsed),
          upgrade_credit_expires_at: serviceTier === 'tier1' ? upgradeExpires : null,
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
      if (res.ok) {
        onToast(`Saved ${serviceTier.toUpperCase()} care log for ${clientSlug || 'new_client'}`);
        setEditorOpen(false);
        await onRefresh();
      } else {
        onToast('Failed to upsert care log', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRollupFromRuns = async () => {
    setRollingUp(true);
    try {
      const res = await fetch('/api/care-logs/rollup', { method: 'POST' });
      if (res.ok) {
        onToast('Rolled up Make automation_runs across Tier 1, 2 & 3 logs');
        await onRefresh();
      } else {
        onToast('Rollup failed', 'error');
      }
    } finally {
      setRollingUp(false);
    }
  };

  const tierLabel = (t: ServiceTier) => (t === 'tier1' ? 'T1' : t === 'tier3' ? 'T3' : 'T2');
  const tierColor = (t: ServiceTier) =>
    t === 'tier1'
      ? 'text-zinc-700 dark:text-zinc-300'
      : t === 'tier3'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-indigo-600 dark:text-indigo-400';

  const buildEmailRecap = (log: MonthlyCareLog) => {
    if (log.service_tier === 'tier1') {
      return `Subject: ${log.client_slug} — Tier 1 Sprint Launch Check & 45-Day Upgrade Credit

Hi Team,

Here is your post-launch operational check for ${log.care_month.slice(0, 7)} under your Tier 1 Conversion & Intake Sprint ($3,500 one-time):

• Site Uptime: ${Number(log.site_uptime_pct).toFixed(2)}% (${log.downtime_incidents_count} downtime incidents)
• Core Speed-to-Lead Pipeline: ${log.wf1_lead_runs} instant form/booking runs (${log.failed_runs_count} errors)
• 14-Day Bug Coverage Notes: ${log.care_tweaks_summary}
• 45-Day Tier 2 Upgrade Credit: 100% of your $3,500 Tier 1 fee remains eligible for credit toward Tier 2 (up to 7 pages + 3 workflows + $650/mo managed care) through ${log.upgrade_credit_expires_at || '2026-12-28'}.

Reply here if you'd like to schedule the Tier 2 expansion roadmap.

Best,
Coco Club Live Web Automation Agency`;
    }

    if (log.service_tier === 'tier3') {
      return `Subject: ${log.client_slug} — Tier 3 Engineering Retainer Summary ($1,250/mo)

Hi Team,

Here is your Tier 3 Operations & Portal Suite summary for ${log.care_month.slice(0, 7)}:

• Platform & Portal Uptime: ${Number(log.site_uptime_pct).toFixed(2)}% (${log.downtime_incidents_count} downtime incidents)
• Automated Pipelines Executed: ${log.total_workflow_runs} total runs (WF1 Intake/Quoting: ${log.wf1_lead_runs}, WF2 Scheduling: ${log.wf2_booking_runs}, WF3 Follow-Up/Billing: ${log.wf3_followup_runs})
• Error Handling: ${log.failed_runs_count} flagged run(s), ${log.dropped_or_retried_count} retried — ${log.top_error_summary}
• Retainer Engineering Hours (${log.care_hours_used}/${log.included_hours} hrs used): ${log.care_tweaks_summary}
• Separate Change Orders: ${log.change_orders_count} ($${Number(log.change_order_revenue).toLocaleString('en-US')})

Reply here with next month's priority automation or portal expansion items.

Best,
Coco Club Live Web Automation Agency`;
    }

    return `Subject: ${log.client_slug} — Tier 2 Monthly Care & Automation Summary ($650/mo)

Hi Team,

Here is your concise Tier 2 care summary for ${log.care_month.slice(0, 7)}:

• Site Uptime: ${Number(log.site_uptime_pct).toFixed(2)}% (${log.downtime_incidents_count} downtime incidents)
• Live Make Automations: ${log.total_workflow_runs} total runs (WF1 Lead Routing: ${log.wf1_lead_runs}, WF2 Reminders: ${log.wf2_booking_runs}, WF3 Follow-Ups: ${log.wf3_followup_runs})
• Error Handling: ${log.failed_runs_count} flagged run(s), ${log.dropped_or_retried_count} retried cleanly — ${log.top_error_summary}
• Care Plan Tweaks (${log.care_hours_used}/${log.included_hours} hrs used · ${log.care_tweaks_count} items): ${log.care_tweaks_summary}
• Separate Change Orders: ${log.change_orders_count} ($${Number(log.change_order_revenue).toLocaleString('en-US')})

Everything is running nominally. Reply here if you'd like any minor copy/link adjustments queued for next month.

Best,
Coco Club Live Web Automation Agency`;
  };

  const buildSlackRecap = (log: MonthlyCareLog) => {
    const planLabel =
      log.service_tier === 'tier1'
        ? 'Tier 1 Sprint ($3,500)'
        : log.service_tier === 'tier3'
          ? 'Tier 3 Retainer ($1,250/mo)'
          : 'Tier 2 Care ($650/mo)';
    return `*${planLabel} Recap — \`${log.client_slug}\` (${log.care_month.slice(0, 7)})*
• Uptime: *${Number(log.site_uptime_pct).toFixed(2)}%* | Make Runs: *${log.total_workflow_runs}* (${log.failed_runs_count} failed / ${log.dropped_or_retried_count} retried)
• Hours / Tweaks (${log.care_hours_used}/${log.included_hours}h): ${log.care_tweaks_summary}
• Change Orders: ${log.change_orders_count} ($${Number(log.change_order_revenue).toLocaleString('en-US')})`;
  };

  // ROI Calculator math
  const dealVal = Math.max(0, Number(avgDealValue) || 0);
  const closeRate = Math.min(100, Math.max(0, Number(closeRatePct) || 0)) / 100;
  const leadsRec = Math.max(0, Number(recoveredLeads) || 0);
  const monthlyRecovered = leadsRec * closeRate * dealVal;

  return (
    <div className="space-y-5">
      {/* Agency Retainer & Revenue Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active Retainer MRR
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
              ${totals.mrr.toLocaleString('en-US')}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">/mo</span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Tier 2 ($650) + Tier 3 ($1,250)
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active Setup Value
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
              ${totals.setupTotal.toLocaleString('en-US')}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
            {logs.filter((l) => l.service_tier === 'tier1').length} T1 ·{' '}
            {logs.filter((l) => l.service_tier === 'tier2').length} T2 ·{' '}
            {logs.filter((l) => l.service_tier === 'tier3').length} T3
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Automations Executed
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
              {totals.totalRuns.toLocaleString('en-US')}
            </span>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
              {totals.avgUptime}% avg uptime
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Monitored via Make & Neon
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Change Orders & ROI
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
                ${totals.coRev.toLocaleString('en-US')}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">billed</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRoiDrawerOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Open 3-Question ROI Calculator</span>
          </button>
        </div>
      </div>

      {/* Productized 3-Tier Matrix (Tier 1 · Tier 2 Core · Tier 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tierCatalog.map((tier) => {
          const isCore = tier.id === 'tier2';
          return (
            <div
              key={tier.id}
              className={`bg-white dark:bg-zinc-900 rounded-lg p-4 space-y-3 border ${
                isCore
                  ? 'border-indigo-500/60 dark:border-indigo-500/50'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">{tier.name}</div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{tier.tagline}</p>
                </div>
                {isCore && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0">
                    Core Anchor
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xl font-semibold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
                  ${tier.setupFee.toLocaleString('en-US')}
                  {tier.id === 'tier3' ? '+' : ''}
                </span>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {tier.monthlyFee > 0 ? `+ $${tier.monthlyFee.toLocaleString('en-US')}/mo` : 'one-time setup'}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Web Scope:</span> {tier.webScope}
                </div>
                <div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Automation:</span>{' '}
                  {tier.automationLimitLabel} · {tier.turnaround}
                </div>
                <div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Milestones:</span> {tier.paymentTerms}
                </div>
                <div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Care / SLA:</span> {tier.supportWindow}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Tier Client Care & Retainer Ledger */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Coco Club Live Client Care & Retainer Ledger
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Unified monthly tracking across Tier 1 sprints, Tier 2 ($650/mo) care, and Tier 3 ($1,250/mo) retainers
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
              {(
                [
                  ['all', `All (${logs.length})`],
                  ['tier1', 'Tier 1 ($3.5k)'],
                  ['tier2', 'Tier 2 ($650/m)'],
                  ['tier3', 'Tier 3 ($1,250/m)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTierFilter(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    tierFilter === key
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
              onClick={() => openEditDrawer()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Client Log</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRollupFromRuns()}
              disabled={rollingUp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rollingUp ? 'animate-spin' : ''}`} />
              <span>Roll Up Runs</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-3">Tier & Fee</th>
                <th className="py-2.5 px-3 text-right">Uptime</th>
                <th className="py-2.5 px-3 text-right">WF1 / WF2 / WF3</th>
                <th className="py-2.5 px-3 text-right">Hours</th>
                <th className="py-2.5 px-3 text-right">Failed</th>
                <th className="py-2.5 px-3 text-right">Change Orders</th>
                <th className="py-2.5 px-3">Care / Sprint Summary</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => openEditDrawer(log)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{log.client_slug}</div>
                    <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{log.care_month}</div>
                  </td>
                  <td className="py-3 px-3 font-mono whitespace-nowrap">
                    <span className={`font-semibold ${tierColor(log.service_tier)}`}>
                      {tierLabel(log.service_tier)}
                    </span>
                    <span className="text-zinc-400 mx-1">·</span>
                    <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">
                      ${Number(log.monthly_retainer_fee || 0).toLocaleString('en-US')}/m
                    </span>
                    <div className="text-[11px] text-zinc-500 tabular-nums">
                      ${Number(log.setup_fee || 0).toLocaleString('en-US')} setup
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {Number(log.site_uptime_pct).toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {log.wf1_lead_runs} / {log.wf2_booking_runs} / {log.wf3_followup_runs}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {log.included_hours > 0 ? `${log.care_hours_used}/${log.included_hours}h` : '14d bug'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                      log.failed_runs_count > 0
                        ? 'text-amber-700 dark:text-amber-400 font-semibold'
                        : 'text-zinc-500'
                    }`}
                  >
                    {log.failed_runs_count} ({log.dropped_or_retried_count} retried)
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {log.change_orders_count} (${Number(log.change_order_revenue).toLocaleString('en-US')})
                  </td>
                  <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 max-w-[220px]">
                    <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">{log.top_error_summary}</div>
                    <div className="truncate text-[11px] text-zinc-500 mt-0.5">{log.care_tweaks_summary}</div>
                  </td>
                  <td
                    className="py-3 px-4 text-right whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(log)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecapLog(log)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Client Recap</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Care Log Editor Slide-Over Drawer */}
      <SlideOverDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={clientSlug ? `Edit Client Care · ${clientSlug}` : 'Add Client Care Record'}
        subtitle="Supports Tier 1 Sprint, Tier 2 Care ($650/mo), and Tier 3 Retainer ($1,250/mo)"
        widthClass="max-w-xl"
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Client Slug
              </label>
              <input
                type="text"
                required
                value={clientSlug}
                onChange={(e) => setClientSlug(e.target.value)}
                placeholder="e.g. peachtree_hvac"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Service Tier
              </label>
              <select
                value={serviceTier}
                onChange={(e) => applyTierDefaults(e.target.value as ServiceTier)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                <option value="tier1">Tier 1 — $3,500 Sprint ($0/mo)</option>
                <option value="tier2">Tier 2 — $7,500 + $650/mo Care</option>
                <option value="tier3">Tier 3 — $14,500+ + $1,250/mo Retainer</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Setup Fee ($)
              </label>
              <input
                type="number"
                value={setupFee}
                onChange={(e) => setSetupFee(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Monthly Retainer ($)
              </label>
              <input
                type="number"
                value={monthlyRetainer}
                onChange={(e) => setMonthlyRetainer(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Included Hours / Mo
              </label>
              <input
                type="number"
                step="0.5"
                value={includedHours}
                onChange={(e) => setIncludedHours(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Hours Used This Month
              </label>
              <input
                type="number"
                step="0.5"
                value={hoursUsed}
                onChange={(e) => setHoursUsed(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            {serviceTier === 'tier1' && (
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  45-Day 100% Upgrade Credit Expires
                </label>
                <input
                  type="date"
                  value={upgradeExpires}
                  onChange={(e) => setUpgradeExpires(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Care Month (YYYY-MM-01)
              </label>
              <input
                type="text"
                required
                value={careMonth}
                onChange={(e) => setCareMonth(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Uptime %</label>
              <input
                type="number"
                step="0.01"
                value={uptimePct}
                onChange={(e) => setUptimePct(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                WF1 Lead Runs
              </label>
              <input
                type="number"
                value={wf1Runs}
                onChange={(e) => setWf1Runs(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                WF2 Booking Runs
              </label>
              <input
                type="number"
                value={wf2Runs}
                onChange={(e) => setWf2Runs(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                WF3 Follow-Up Runs
              </label>
              <input
                type="number"
                value={wf3Runs}
                onChange={(e) => setWf3Runs(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Failed Runs
              </label>
              <input
                type="number"
                value={failedRuns}
                onChange={(e) => setFailedRuns(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Change Orders Count
              </label>
              <input
                type="number"
                value={changeOrdersCount}
                onChange={(e) => setChangeOrdersCount(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Change Order Revenue ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={changeOrderRevenue}
                onChange={(e) => setChangeOrderRevenue(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Care Tweaks / Engineering Summary
              </label>
              <textarea
                rows={2}
                value={tweaksSummary}
                onChange={(e) => setTweaksSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Care Log...' : 'Save & Upsert Care Log'}</span>
          </button>
        </form>
      </SlideOverDrawer>

      {/* Client Month-End Recap Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(recapLog)}
        onClose={() => setRecapLog(null)}
        title={recapLog ? `Client Recap · ${recapLog.client_slug}` : ''}
        subtitle={
          recapLog
            ? `Coco Club Live Web Automation Agency · ${recapLog.service_tier.toUpperCase()} summary`
            : ''
        }
        widthClass="max-w-2xl"
      >
        {recapLog && (
          <div className="space-y-4">
            <CodeCopyPanel
              title="Client Email Recap (Copy-Paste Ready)"
              subtitle="Formatted cleanly for client tier & billing model"
              code={buildEmailRecap(recapLog)}
              maxHeightClass="max-h-80"
            />
            <CodeCopyPanel
              title="Slack Client Channel Update"
              code={buildSlackRecap(recapLog)}
              maxHeightClass="max-h-48"
            />
          </div>
        )}
      </SlideOverDrawer>

      {/* 3-Question SBA ROI Calculator Drawer */}
      <SlideOverDrawer
        open={roiDrawerOpen}
        onClose={() => setRoiDrawerOpen(false)}
        title="3-Question SBA ROI Calculator"
        subtitle="Live discovery & scope call payback math across Tiers 1, 2 & 3"
        widthClass="max-w-xl"
      >
        <div className="space-y-5 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Q1: Avg Job / Customer ($)
              </label>
              <input
                type="number"
                value={avgDealValue}
                onChange={(e) => setAvgDealValue(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Q2: Close Rate (%)
              </label>
              <input
                type="number"
                value={closeRatePct}
                onChange={(e) => setCloseRatePct(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Q3: Recovered Leads / Mo
              </label>
              <input
                type="number"
                step="0.5"
                value={recoveredLeads}
                onChange={(e) => setRecoveredLeads(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
              />
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Monthly Recovered Revenue</span>
              <span className="text-xl font-semibold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                ${Math.round(monthlyRecovered).toLocaleString('en-US')}/mo
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 font-mono tabular-nums">
              {tierCatalog.map((t) => {
                const payback = monthlyRecovered > 0 ? (t.setupFee / monthlyRecovered).toFixed(1) : '—';
                return (
                  <div key={t.id}>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.shortLabel}</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      {payback} mo payback
                    </div>
                    <div className="text-[11px] text-zinc-500">${t.setupFee.toLocaleString('en-US')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <CodeCopyPanel
            title="Live Call Script (Coco Club Live Web Automation Agency)"
            code={`"Suppose automating speed-to-lead, booking reminders, and cleaner web intake simply saves ${leadsRec} inquiries a month. At a ${Math.round(closeRate * 100)}% close rate and $${dealVal.toLocaleString('en-US')} average job value, that's $${Math.round(monthlyRecovered).toLocaleString('en-US')}/mo in recovered revenue — paying back a Tier 2 build ($7,500) in ${monthlyRecovered > 0 ? (7500 / monthlyRecovered).toFixed(1) : '—'} months (or a Tier 1 Sprint in ${monthlyRecovered > 0 ? (3500 / monthlyRecovered).toFixed(1) : '—'} months with a 45-day 100% upgrade credit)."`}
            maxHeightClass="max-h-40"
          />
        </div>
      </SlideOverDrawer>
    </div>
  );
}
