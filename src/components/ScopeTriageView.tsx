import { useEffect, useState } from 'react';
import { CheckCircle2, Scale } from 'lucide-react';
import type { ServiceTier } from '../types';
import { CodeCopyPanel } from './CodeCopyPanel';

interface TriageResult {
  serviceTier?: ServiceTier;
  classification: 'Bug Fix' | 'Routine Care' | 'Retainer Expansion' | 'Billable Change Order' | string;
  billingTreatment: string;
  emailReply: string;
  slackReply: string;
}

interface PresetScenario {
  id: string;
  label: string;
  title: string;
  inAgreedSpec: boolean;
  isBrokenBehavior: boolean;
  notExternalOrClientEdit: boolean;
  minorCareTweak: boolean;
  netNewFeature: boolean;
  changedLogic: boolean;
  postApprovalRedesign: boolean;
}

const PRESETS: PresetScenario[] = [
  {
    id: 'bug',
    label: 'Broken Agreed Webhook',
    title: 'Booking form webhook stopped posting to Airtable after deployment',
    inAgreedSpec: true,
    isBrokenBehavior: true,
    notExternalOrClientEdit: true,
    minorCareTweak: false,
    netNewFeature: false,
    changedLogic: false,
    postApprovalRedesign: false,
  },
  {
    id: 'care',
    label: 'Minor Care / Retainer Tweak',
    title: 'Update booking reminder lead time from 24h to 18h & phone copy on /quote',
    inAgreedSpec: false,
    isBrokenBehavior: false,
    notExternalOrClientEdit: true,
    minorCareTweak: true,
    netNewFeature: false,
    changedLogic: false,
    postApprovalRedesign: false,
  },
  {
    id: 'workflow',
    label: 'Extra Make Workflow (+$750)',
    title: 'Add standalone Make workflow for ServiceTitan commercial dispatch routing',
    inAgreedSpec: false,
    isBrokenBehavior: false,
    notExternalOrClientEdit: true,
    minorCareTweak: false,
    netNewFeature: true,
    changedLogic: false,
    postApprovalRedesign: false,
  },
  {
    id: 'redesign',
    label: 'Post-Approval Redesign',
    title: 'Re-layout approved homepage hero and multi-step intake flow',
    inAgreedSpec: false,
    isBrokenBehavior: false,
    notExternalOrClientEdit: true,
    minorCareTweak: false,
    netNewFeature: false,
    changedLogic: true,
    postApprovalRedesign: true,
  },
];

const TIER_PAYMENT_GATES: Record<
  ServiceTier,
  { label: string; depositAmount: string; milestone2Label: string; milestone2Amount: string }
> = {
  tier1: {
    label: 'Tier 1 Sprint ($3,500 · 50%/50%)',
    depositAmount: '$1,750',
    milestone2Label: 'Launch & Handoff Balance (50%)',
    milestone2Amount: '$1,750',
  },
  tier2: {
    label: 'Tier 2 Core ($7,500 + $650/mo · 30/40/30)',
    depositAmount: '$2,250',
    milestone2Label: 'Milestone 2 Staging Balance (40%)',
    milestone2Amount: '$3,000',
  },
  tier3: {
    label: 'Tier 3 Suite ($14,500+ + $1,250/mo · 30/40/30)',
    depositAmount: '$4,350',
    milestone2Label: 'Milestone 2 Portal & ERP Balance (40%)',
    milestone2Amount: '$5,800',
  },
};

export function ScopeTriageView() {
  const [serviceTier, setServiceTier] = useState<ServiceTier>('tier2');
  const [activePreset, setActivePreset] = useState<string>('workflow');
  const [inAgreedSpec, setInAgreedSpec] = useState(false);
  const [isBrokenBehavior, setIsBrokenBehavior] = useState(false);
  const [notExternalOrClientEdit, setNotExternalOrClientEdit] = useState(true);
  const [minorCareTweak, setMinorCareTweak] = useState(false);
  const [netNewFeature, setNetNewFeature] = useState(true);
  const [changedLogic, setChangedLogic] = useState(false);
  const [postApprovalRedesign, setPostApprovalRedesign] = useState(false);

  const [clientName, setClientName] = useState('Marcus');
  const [companyName, setCompanyName] = useState('Apex HVAC');
  const [requestTitle, setRequestTitle] = useState('Add standalone Make workflow for ServiceTitan commercial dispatch routing');
  const [quotePrice, setQuotePrice] = useState('750');
  const [turnaround, setTurnaround] = useState('3 business days');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [outputTab, setOutputTab] = useState<'email' | 'slack' | 'deposit' | 'milestone2'>('email');

  const evaluate = async (
    payloadOverride?: Partial<PresetScenario> & { serviceTier?: ServiceTier }
  ) => {
    const res = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTier: payloadOverride?.serviceTier ?? serviceTier,
        inAgreedSpec: payloadOverride?.inAgreedSpec ?? inAgreedSpec,
        isBrokenBehavior: payloadOverride?.isBrokenBehavior ?? isBrokenBehavior,
        notExternalOrClientEdit: payloadOverride?.notExternalOrClientEdit ?? notExternalOrClientEdit,
        minorCareTweak: payloadOverride?.minorCareTweak ?? minorCareTweak,
        netNewFeature: payloadOverride?.netNewFeature ?? netNewFeature,
        changedLogic: payloadOverride?.changedLogic ?? changedLogic,
        postApprovalRedesign: payloadOverride?.postApprovalRedesign ?? postApprovalRedesign,
        clientName,
        companyName,
        requestTitle: payloadOverride?.title ?? requestTitle,
        quotePrice: Number(quotePrice),
        turnaround,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
    }
  };

  useEffect(() => {
    void evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset: PresetScenario) => {
    setActivePreset(preset.id);
    setRequestTitle(preset.title);
    setInAgreedSpec(preset.inAgreedSpec);
    setIsBrokenBehavior(preset.isBrokenBehavior);
    setNotExternalOrClientEdit(preset.notExternalOrClientEdit);
    setMinorCareTweak(preset.minorCareTweak);
    setNetNewFeature(preset.netNewFeature);
    setChangedLogic(preset.changedLogic);
    setPostApprovalRedesign(preset.postApprovalRedesign);
    void evaluate(preset);
  };

  const handleSelectTier = (nextTier: ServiceTier) => {
    setServiceTier(nextTier);
    void evaluate({ serviceTier: nextTier });
  };

  const gate = TIER_PAYMENT_GATES[serviceTier];

  const depositGateEmail = `Subject: Quick reminder: ${companyName} deposit invoice to lock in your build slot

Hi ${clientName},
Thanks again for signing off on ${requestTitle}.
Just a quick reminder that the deposit invoice (${gate.depositAmount} under ${gate.label}, or $${quotePrice} for the change order) is ready here: [Payment / Invoice Link]. As soon as that clears, I'll lock in your build slot and kick off work right away (${turnaround} from clearance).
Let me know if you need the invoice resent or routed to anyone else on your team.
Best,
Coco Club Live Web Automation Agency`;

  const milestone2GateEmail = `Subject: ${companyName} staging approved — ${gate.milestone2Label} before DNS cutover

Hi ${clientName},
Thanks for approving the staging build for ${companyName}.
Quick reminder that the ${gate.milestone2Label} (${gate.milestone2Amount}) is due here before we flip DNS and push live: [Payment / Invoice Link]. Once that clears, I'll run our final pre-launch checks, complete the DNS cutover, and send over your launch handoff summary (within 24 hours of clearance).
Let me know if you need the invoice resent or routed to anyone else on your team.
Best,
Coco Club Live Web Automation Agency`;

  const verdictColor =
    result?.classification === 'Bug Fix'
      ? 'text-emerald-700 dark:text-emerald-400'
      : result?.classification === 'Routine Care' || result?.classification === 'Retainer Expansion'
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-amber-700 dark:text-amber-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Guided Decision Matrix */}
      <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Coco Club Live Scope & Change Order Gate
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Enforces hard scope ceilings across Tier 1 (1 workflow), Tier 2 (3 workflows), and Tier 3 (unlimited + 5h/mo).
            </p>
          </div>
          <Scale className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        </div>

        {/* Client Service Tier Selector */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Client Service Tier
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
            {(
              [
                ['tier1', 'Tier 1 ($3.5k)'],
                ['tier2', 'Tier 2 ($650/m)'],
                ['tier3', 'Tier 3 ($1,250/m)'],
              ] as const
            ).map(([tId, label]) => (
              <button
                key={tId}
                type="button"
                onClick={() => handleSelectTier(tId)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  serviceTier === tId
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Scenario Bar */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Quick Scenario Presets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Client First Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Client Request Summary
            </label>
            <input
              type="text"
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Change Order Price ($)
            </label>
            <input
              type="number"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Turnaround Window
            </label>
            <input
              type="text"
              value={turnaround}
              onChange={(e) => setTurnaround(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2 text-xs">
          <div className="font-semibold text-zinc-800 dark:text-zinc-200">
            Bug Fix Conditions (all 3 must hold)
          </div>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={inAgreedSpec}
              onChange={(e) => setInAgreedSpec(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Explicitly in signed SOW / locked sitemap / kickoff recap</span>
          </label>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isBrokenBehavior}
              onChange={(e) => setIsBrokenBehavior(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Broken behavior relative to agreed spec (failed webhook, broken mapping)</span>
          </label>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notExternalOrClientEdit}
              onChange={(e) => setNotExternalOrClientEdit(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Not caused by third-party API change or client edits to live credentials</span>
          </label>

          <div className="font-semibold text-zinc-800 dark:text-zinc-200 pt-2">
            Routine Care / Retainer vs. Change Order Signals
          </div>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={minorCareTweak}
              onChange={(e) => setMinorCareTweak(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Minor copy/link/timing tweak (Tier 2: 2h/mo · Tier 3: 5h/mo · Tier 1: out of scope)</span>
          </label>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={netNewFeature}
              onChange={(e) => setNetNewFeature(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Adds a net-new page, extra Make scenario/workflow (+$750), or new integration</span>
          </label>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={changedLogic}
              onChange={(e) => setChangedLogic(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Changes qualification, routing rules, or scheduling cadence after kickoff lock</span>
          </label>
          <label className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={postApprovalRedesign}
              onChange={(e) => setPostApprovalRedesign(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Post-approval visual/layout redesign where original matched spec</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void evaluate()}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Evaluate Scope & Refresh Templates</span>
        </button>
      </div>

      {/* Right: Verdict + Tabbed Copyable Outputs */}
      <div className="lg:col-span-6 space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Deterministic Classification Verdict · {gate.label}
          </div>
          <div className={`text-xl font-semibold mt-1 ${verdictColor}`}>
            {result?.classification || 'Evaluating...'}
          </div>
          <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 mt-1">
            {result?.billingTreatment || ''}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
          {(
            [
              ['email', 'Client Email'],
              ['slack', 'Slack Note'],
              ['deposit', `Deposit (${gate.depositAmount})`],
              ['milestone2', `Final (${gate.milestone2Amount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOutputTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                outputTab === key
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {outputTab === 'email' && (
          <CodeCopyPanel
            title="Client Email Response (Copy-Paste Ready)"
            subtitle="Concise, matter-of-fact, boundary-clear · Coco Club Live Web Automation Agency"
            code={result?.emailReply || ''}
            maxHeightClass="max-h-96"
          />
        )}

        {outputTab === 'slack' && (
          <CodeCopyPanel
            title="Slack / Quick-Note Reply"
            subtitle="For #client-updates or direct Slack thread"
            code={result?.slackReply || ''}
            maxHeightClass="max-h-96"
          />
        )}

        {outputTab === 'deposit' && (
          <CodeCopyPanel
            title={`Deposit / Invoice Gate Reminder (${gate.depositAmount})`}
            subtitle="Send right after SOW or Change Order approval before starting work"
            code={depositGateEmail}
            maxHeightClass="max-h-96"
          />
        )}

        {outputTab === 'milestone2' && (
          <CodeCopyPanel
            title={`${gate.milestone2Label} (${gate.milestone2Amount})`}
            subtitle="Send right after staging sign-off, before DNS cutover"
            code={milestone2GateEmail}
            maxHeightClass="max-h-96"
          />
        )}
      </div>
    </div>
  );
}
