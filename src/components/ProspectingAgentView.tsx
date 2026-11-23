import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Globe,
  Loader2,
  Mail,
  Phone,
  Play,
  Send,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type {
  AgentCandidate,
  AgentRunResult,
  Prospect,
  ServiceTier,
  TierSpec,
} from '../types';

interface ProspectingAgentViewProps {
  prospects: Prospect[];
  tiers: TierSpec[];
  externalProspectId?: string | null;
  onClearExternalProspect?: () => void;
  onRefresh: () => Promise<void>;
  onOpenInQueue: (prospectId: string) => void;
  onToast: (message: string, tone?: 'success' | 'error') => void;
}

type OutreachTab = 'email1' | 'email2' | 'call' | 'voicemail' | 'loom';

const VERTICAL_PRESETS = [
  {
    id: 'hvac',
    label: 'HVAC & Plumbing (238220)',
    vertical: 'Plumbing, Heating & Air-Conditioning (NAICS 238220)',
    query:
      'Find independent local HVAC and plumbing contractors with strong Google reviews whose websites lack instant online scheduling or have mobile friction',
  },
  {
    id: 'dental',
    label: 'Dental & Spine Clinics (6212)',
    vertical: 'Dental & Physical Therapy Practices (NAICS 621210 / 621340)',
    query:
      'Find independent local dental or physical therapy practices with high patient review volume relying on static contact forms or phone-only intake',
  },
  {
    id: 'auto',
    label: 'Auto & Fleet Collision (8111)',
    vertical: 'Automotive Collision, Fleet & Mechanical Repair (NAICS 811121)',
    query:
      'Find independent commercial fleet repair and auto collision shops with strong local reputation and legacy quote request forms',
  },
  {
    id: 'janitorial',
    label: 'Commercial Cleaning (561720)',
    vertical: 'Commercial Janitorial & Facility Services (NAICS 561720)',
    query:
      'Find established independent commercial cleaning and facility maintenance companies needing automated B2B walkthrough booking',
  },
] as const;

const GEO_PRESETS = ['Atlanta, GA', 'Houston, TX', 'Charlotte, NC', 'Tampa, FL', 'Nashville, TN'];

export function ProspectingAgentView({
  prospects,
  tiers,
  externalProspectId,
  onClearExternalProspect,
  onRefresh,
  onOpenInQueue,
  onToast,
}: ProspectingAgentViewProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('hvac');
  const [vertical, setVertical] = useState<string>(VERTICAL_PRESETS[0].vertical);
  const [geography, setGeography] = useState<string>('Atlanta, GA');
  const [query, setQuery] = useState<string>(VERTICAL_PRESETS[0].query);
  const [acquisitionFocus, setAcquisitionFocus] = useState<boolean>(true);
  const [maxCandidates, setMaxCandidates] = useState<number>(4);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<AgentRunResult | null>(null);
  const [historyRuns, setHistoryRuns] = useState<AgentRunResult[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [outreachTab, setOutreachTab] = useState<OutreachTab>('email1');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [existingProspectId, setExistingProspectId] = useState<string>(prospects[0]?.id || '');
  const [qualifyingExisting, setQualifyingExisting] = useState(false);
  const [approvingAction, setApprovingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!existingProspectId && prospects.length > 0) {
      setExistingProspectId(prospects[0].id);
    }
  }, [prospects, existingProspectId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent/history')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.runs) && data.runs.length > 0) {
          setHistoryRuns(data.runs);
          setActiveRun((prev) => prev || data.runs[0]);
          setSelectedCandidateId((prev) => prev || data.runs[0].candidates?.[0]?.candidate_id || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleQualifyExisting = async (targetId: string) => {
    if (!targetId) return;
    setQualifyingExisting(true);
    setRunError(null);
    try {
      const res = await fetch('/api/agent/qualify-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to qualify existing operator');
      }
      const cand = data.candidate as AgentCandidate;
      const syntheticRun: AgentRunResult = {
        run_id: `existing_${Date.now()}`,
        query: `CRM Operator Qualification · ${cand.prospect.borr_name}`,
        vertical: cand.prospect.naics_description || 'Existing SBA Prospect',
        geography: `${cand.prospect.borr_city}, ${cand.prospect.borr_state}`,
        created_at: new Date().toISOString(),
        steps: [
          {
            id: 'discovery',
            label: 'CRM Operator Loaded',
            status: 'passed',
            duration_ms: 12,
            detail: `Loaded ${cand.prospect.borr_name} (${cand.prospect.dedupe_id})`,
          },
          {
            id: 'audit_qualify',
            label: 'Site Audit & Deterministic Scoring',
            status: 'passed',
            duration_ms: cand.prospect.response_time_ms || 140,
            detail: `Score ${cand.prospect.computed_lead_score}/100 · ${cand.prospect.campaign_track}`,
          },
          {
            id: 'outreach',
            label: 'Tier Fit & Outreach Kit Synthesis',
            status: 'passed',
            duration_ms: 680,
            detail: `Generated 5 outreach assets tailored for ${cand.outreach.recommended_tier.toUpperCase()}`,
          },
        ],
        candidates: [cand],
        grounding_sources: [],
      };
      setActiveRun(syntheticRun);
      setSelectedCandidateId(cand.candidate_id);
      setOutreachTab('email1');
      onToast(`Generated bespoke outreach kit for ${cand.prospect.borr_name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to qualify prospect';
      setRunError(msg);
      onToast(msg, 'error');
    } finally {
      setQualifyingExisting(false);
    }
  };

  useEffect(() => {
    if (externalProspectId) {
      setExistingProspectId(externalProspectId);
      onClearExternalProspect?.();
      void handleQualifyExisting(externalProspectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalProspectId]);

  const handleRunAgent = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          vertical,
          geography,
          acquisitionFocus,
          maxCandidates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Agent run failed');
      }
      const run = data as AgentRunResult;
      setActiveRun(run);
      setHistoryRuns((prev) => [run, ...prev.slice(0, 7)]);
      setSelectedCandidateId(run.candidates[0]?.candidate_id || null);
      setOutreachTab('email1');
      onToast(`Agent qualified ${run.candidates.length} prospect(s) in ${geography}`);
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent run failed';
      setRunError(msg);
      onToast(msg, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleApproveCandidate = async (
    candidate: AgentCandidate,
    options: { logTouch: boolean; channel?: 'email' | 'phone_call' | 'voicemail' }
  ) => {
    const key = `${candidate.candidate_id}_${options.logTouch ? options.channel : 'queue'}`;
    setApprovingAction(key);
    try {
      const res = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate,
          logTouch: options.logTouch,
          channel: options.channel || 'email',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync prospect to CRM');
      }

      setActiveRun((prev) =>
        prev
          ? {
              ...prev,
              candidates: prev.candidates.map((c) =>
                c.candidate_id === candidate.candidate_id
                  ? { ...c, already_in_crm: true, existing_prospect_id: data.prospect.id }
                  : c
              ),
            }
          : prev
      );

      onToast(
        options.logTouch
          ? `Synced ${candidate.prospect.borr_name} & logged ${options.channel || 'email'} touch (+3d follow-up)`
          : `Added ${candidate.prospect.borr_name} to Daily Queue as Ready`
      );
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CRM sync failed';
      onToast(msg, 'error');
    } finally {
      setApprovingAction(null);
    }
  };

  const selectedCandidate = useMemo(() => {
    if (!activeRun || activeRun.candidates.length === 0) return null;
    return (
      activeRun.candidates.find((c) => c.candidate_id === selectedCandidateId) || activeRun.candidates[0]
    );
  }, [activeRun, selectedCandidateId]);

  const tierLabel = (tierId: ServiceTier) => {
    const match = tiers.find((t) => t.id === tierId);
    if (match) {
      const price =
        match.monthlyFee > 0
          ? `$${match.setupFee.toLocaleString('en-US')} + $${match.monthlyFee}/mo`
          : `$${match.setupFee.toLocaleString('en-US')} one-time`;
      return `${match.shortLabel} (${price})`;
    }
    if (tierId === 'tier1') return 'Tier 1 Sprint ($3,500 one-time)';
    if (tierId === 'tier3') return 'Tier 3 Suite ($14,500+ + $1,250/mo)';
    return 'Tier 2 Core ($7,500 + $650/mo)';
  };

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onToast('Copied outreach script to clipboard');
    setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1800);
  };

  const activeOutreachText = useMemo(() => {
    if (!selectedCandidate) return '';
    const o = selectedCandidate.outreach;
    if (outreachTab === 'email1') return `Subject: ${o.subject_line}\n\n${o.email_1}`;
    if (outreachTab === 'email2') return `Subject: Re: ${o.subject_line}\n\n${o.email_2_followup}`;
    if (outreachTab === 'call') return o.call_opener_20s;
    if (outreachTab === 'voicemail') return o.voicemail_20s;
    return o.loom_talking_points.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
  }, [selectedCandidate, outreachTab]);

  return (
    <div className="space-y-5">
      {/* Top Control Bar: Discovery Brief + Existing Prospect Quick Qualify */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Prospecting, Qualification & Outreach Agent
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Discovers real operators via Google Search grounding, probes live website speed & booking friction, scores deterministically, and drafts Tier 1–3 outreach.
              </p>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
              Search Grounding · Live HTTP Audit · Tier 1–3 Fit
            </div>
          </div>

          {/* Interactive Vertical Preset Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {VERTICAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset.id);
                  setVertical(preset.vertical);
                  setQuery(preset.query);
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedPreset === preset.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Target City & State
              </label>
              <input
                type="text"
                list="geo-presets"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. Atlanta, GA"
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <datalist id="geo-presets">
                {GEO_PRESETS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Industry / NAICS Focus
              </label>
              <input
                type="text"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Batch Size
              </label>
              <select
                value={maxCandidates}
                onChange={(e) => setMaxCandidates(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                <option value={2}>2 qualified prospects</option>
                <option value={4}>4 qualified prospects</option>
                <option value={6}>6 qualified prospects</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Prospecting Brief
            </label>
            <textarea
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe the target business profile, website friction, or expansion signal..."
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={acquisitionFocus}
                onChange={(e) => setAcquisitionFocus(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>Prioritize ownership transitions, recent expansions & multi-truck operators</span>
            </label>

            <button
              type="button"
              disabled={running || qualifyingExisting}
              onClick={() => void handleRunAgent()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Prospecting & Auditing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Prospecting Agent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side Panel: Qualify Existing CRM Lead + Past Runs */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Qualify Existing SBA Queue Lead
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Re-audit an existing Neon/Airtable operator and synthesize a tailored 5-asset outreach kit.
              </p>
            </div>
            <select
              value={existingProspectId}
              onChange={(e) => setExistingProspectId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            >
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.borr_name} ({p.borr_city}, {p.borr_state}) · {p.computed_lead_score}/100
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={qualifyingExisting || running || !existingProspectId}
              onClick={() => void handleQualifyExisting(existingProspectId)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {qualifyingExisting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Kit...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Generate Kit for Selected Lead</span>
                </>
              )}
            </button>
          </div>

          {historyRuns.length > 0 && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Recent Agent Runs ({historyRuns.length})
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {historyRuns.slice(0, 4).map((hr) => (
                  <button
                    key={hr.run_id}
                    type="button"
                    onClick={() => {
                      setActiveRun(hr);
                      setSelectedCandidateId(hr.candidates[0]?.candidate_id || null);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      activeRun?.run_id === hr.run_id
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="truncate">{hr.geography} · {hr.vertical}</span>
                    <span className="font-mono tabular-nums shrink-0">{hr.candidates.length} leads</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Honest Upstream / Configuration Error Banner */}
      {runError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-4 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="space-y-1">
            <div className="font-semibold">Prospecting Agent Execution Error</div>
            <p className="text-rose-700 dark:text-rose-300">{runError}</p>
          </div>
        </div>
      )}

      {/* Active Run Execution Trace + Candidate Master-Detail */}
      {activeRun ? (
        <div className="space-y-4">
          {/* 3-Stage Agent Execution Trace */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800 grid grid-cols-1 lg:grid-cols-3">
            {activeRun.steps.map((step, i) => (
              <div key={step.id} className="p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        step.status === 'passed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <span className="truncate">
                      0{i + 1}. {step.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{step.detail}</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0">
                  {step.duration_ms}ms
                </span>
              </div>
            ))}
          </div>

          {/* Master-Detail Qualified Candidates & Outreach Kit */}
          {activeRun.candidates.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No independent local businesses matched the discovery query. Broaden the geography or brief and run again.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Candidate Selector List */}
              <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Qualified Prospects
                  </span>
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {activeRun.candidates.length} found
                  </span>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {activeRun.candidates.map((cand) => {
                    const isSelected = selectedCandidate?.candidate_id === cand.candidate_id;
                    return (
                      <button
                        key={cand.candidate_id}
                        type="button"
                        onClick={() => setSelectedCandidateId(cand.candidate_id)}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/35'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                            {cand.prospect.borr_name}
                          </div>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                              cand.prospect.computed_lead_score >= 80
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {cand.prospect.computed_lead_score}/100
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
                          <span>
                            {cand.prospect.borr_city}, {cand.prospect.borr_state}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {cand.outreach.recommended_tier.toUpperCase()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {cand.prospect.response_time_ms
                              ? `${cand.prospect.response_time_ms}ms`
                              : cand.prospect.site_status}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono truncate">
                          <span
                            className={
                              cand.already_in_crm
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }
                          >
                            {cand.already_in_crm ? 'Synced in CRM' : 'New Discovered Lead'}
                          </span>
                          <span className="text-zinc-400 mx-1.5">·</span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {cand.prospect.has_booking_link ? 'Booking Found' : 'No Instant Booking'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Candidate Deep Dive & Outreach Kit */}
              {selectedCandidate && (
                <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
                  {/* Candidate Header & Diagnostic Strip */}
                  <div className="p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {selectedCandidate.prospect.borr_name}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>
                            {selectedCandidate.prospect.borr_city}, {selectedCandidate.prospect.borr_state}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{selectedCandidate.prospect.naics_description}</span>
                          {selectedCandidate.prospect.owner_name && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Owner: {selectedCandidate.prospect.owner_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {selectedCandidate.prospect.website_url && (
                          <a
                            href={selectedCandidate.prospect.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Visit Site</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                        {selectedCandidate.already_in_crm && selectedCandidate.existing_prospect_id && (
                          <button
                            type="button"
                            onClick={() => onOpenInQueue(selectedCandidate.existing_prospect_id!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-colors cursor-pointer"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>Open in Queue</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4-Metric Telemetry Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Deterministic Score</div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                          {selectedCandidate.prospect.computed_lead_score}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">HTTP Audit Speed</div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                          {selectedCandidate.prospect.response_time_ms
                            ? `${selectedCandidate.prospect.response_time_ms}ms`
                            : selectedCandidate.prospect.site_status}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Reviews & Booking</div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                          {selectedCandidate.prospect.google_review_count} rev ·{' '}
                          {selectedCandidate.prospect.has_booking_link ? 'Booking' : 'No Booking'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Recommended Tier</div>
                        <div className="mt-0.5 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {tierLabel(selectedCandidate.outreach.recommended_tier)}
                        </div>
                      </div>
                    </div>

                    {/* Qualification Rationale & Friction Tags */}
                    <div className="space-y-1.5 text-xs pt-1">
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {selectedCandidate.outreach.qualification_rationale}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        Track: {selectedCandidate.prospect.campaign_track} · Friction:{' '}
                        {selectedCandidate.prospect.friction_tags} · Dedupe:{' '}
                        {selectedCandidate.prospect.dedupe_id}
                      </div>
                    </div>
                  </div>

                  {/* Tabbed Multi-Channel Outreach Kit */}
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
                        {(
                          [
                            ['email1', 'Email 1'],
                            ['email2', '3-Day Nudge'],
                            ['call', '20s Call Opener'],
                            ['voicemail', '20s Voicemail'],
                            ['loom', '90s Loom Script'],
                          ] as const
                        ).map(([tabKey, label]) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => setOutreachTab(tabKey)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              outreachTab === tabKey
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
                        onClick={() => copyText(`${selectedCandidate.candidate_id}_${outreachTab}`, activeOutreachText)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        {copiedKey === `${selectedCandidate.candidate_id}_${outreachTab}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Script</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                      {activeOutreachText}
                    </pre>
                  </div>

                  {/* CRM Upsert & Outbound Execution Actions */}
                  <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/40 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {[selectedCandidate.prospect.owner_email, selectedCandidate.prospect.google_phone]
                        .filter(Boolean)
                        .join(' · ') || 'No direct email/phone found — enrich after adding to queue'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={approvingAction !== null}
                        onClick={() =>
                          void handleApproveCandidate(selectedCandidate, { logTouch: false })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          {selectedCandidate.already_in_crm ? 'Mark Ready in Queue' : 'Add to Daily Queue'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={approvingAction !== null}
                        onClick={() =>
                          void handleApproveCandidate(selectedCandidate, {
                            logTouch: true,
                            channel: 'phone_call',
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Log Call Touch</span>
                      </button>

                      <button
                        type="button"
                        disabled={approvingAction !== null}
                        onClick={() =>
                          void handleApproveCandidate(selectedCandidate, {
                            logTouch: true,
                            channel: 'email',
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {approvingAction === `${selectedCandidate.candidate_id}_email` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Queue & Log Email 1 (+3d Follow-Up)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grounded Web Search Sources (Required for Search Grounding Transparency) */}
          {activeRun.grounding_sources.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Verified Google Search Grounding Sources ({activeRun.grounding_sources.length})
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {activeRun.grounding_sources.map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline max-w-xs truncate"
                    title={src.uri}
                  >
                    <span className="truncate">{src.title}</span>
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Ready to discover, audit & qualify new Coco Club Live prospects
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a target industry preset and city above, then click <span className="font-medium text-zinc-700 dark:text-zinc-200">Run Prospecting Agent</span>—or generate a bespoke kit for any existing SBA operator in your queue.
            </p>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRunAgent()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Run First Prospecting Batch</span>
          </button>
        </div>
      )}
    </div>
  );
}
