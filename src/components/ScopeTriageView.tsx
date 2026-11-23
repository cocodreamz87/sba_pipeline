import { useState } from 'react';
import { Scale } from 'lucide-react';
import { CodeCopyPanel } from './CodeCopyPanel';

export function ScopeTriageView() {
  const [inAgreedSpec, setInAgreedSpec] = useState(false);
  const [isBrokenBehavior, setIsBrokenBehavior] = useState(false);
  const [notExternalOrClientEdit, setNotExternalOrClientEdit] = useState(true);
  const [minorCareTweak, setMinorCareTweak] = useState(false);
  const [netNewFeature, setNetNewFeature] = useState(true);
  const [changedLogic, setChangedLogic] = useState(false);
  const [postApprovalRedesign, setPostApprovalRedesign] = useState(false);

  const [clientName, setClientName] = useState('Marcus');
  const [companyName, setCompanyName] = useState('Apex HVAC');
  const [requestTitle, setRequestTitle] = useState('Add 4th Make workflow for ServiceTitan commercial dispatch');
  const [quotePrice, setQuotePrice] = useState('750');
  const [turnaround, setTurnaround] = useState('3 business days');
  const [result, setResult] = useState<{
    classification: string;
    billingTreatment: string;
    emailReply: string;
    slackReply: string;
  } | null>(null);

  const handleEvaluate = async () => {
    const res = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inAgreedSpec,
        isBrokenBehavior,
        notExternalOrClientEdit,
        minorCareTweak,
        netNewFeature,
        changedLogic,
        postApprovalRedesign,
        clientName,
        companyName,
        requestTitle,
        quotePrice: Number(quotePrice),
        turnaround,
      }),
    });
    const data = await res.json();
    setResult(data);
  };

  const depositGateEmail = `Subject: Quick reminder: ${companyName} deposit invoice to lock in your build slot\n\nHi ${clientName},\nThanks again for signing off on ${requestTitle}.\nJust a quick reminder that the deposit invoice ($${quotePrice}) is ready here: [Payment / Invoice Link]. As soon as that clears, I'll lock in your build slot and kick off work right away (${turnaround} from clearance).\nLet me know if you need the invoice resent or routed to anyone else on your team.\nBest,\nCoco`;

  const milestone2GateEmail = `Subject: ${companyName} staging approved — Milestone 2 balance before DNS cutover\n\nHi ${clientName},\nThanks for approving the staging build for ${companyName}.\nQuick reminder that the remaining Milestone 2 balance ($3,000) is due here before we flip DNS and push live: [Payment / Invoice Link]. Once that clears, I'll run our final pre-launch checks, complete the DNS cutover, and send over your launch handoff summary (within 24 hours of clearance).\nLet me know if you need the invoice resent or routed to anyone else on your team.\nBest,\nCoco`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Bug Fix vs. Billable Change Order Triage
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Deterministic scope gate: Bug Fix requires all 3 agreement conditions; any net-new workflow or rule change triggers a fixed Change Order quote before build.
              </p>
            </div>
            <Scale className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client First Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Client Request Summary</label>
              <input
                type="text"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Change Order Price ($)</label>
              <input
                type="number"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Turnaround Window</label>
              <input
                type="text"
                value={turnaround}
                onChange={(e) => setTurnaround(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
            <div className="font-semibold text-slate-800">Bug Fix Conditions (all 3 must hold)</div>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" checked={inAgreedSpec} onChange={(e) => setInAgreedSpec(e.target.checked)} />
              <span>Explicitly in signed SOW / locked sitemap / kickoff recap</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isBrokenBehavior} onChange={(e) => setIsBrokenBehavior(e.target.checked)} />
              <span>Broken behavior relative to agreed spec (failed webhook, broken link, wrong mapping)</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notExternalOrClientEdit}
                onChange={(e) => setNotExternalOrClientEdit(e.target.checked)}
              />
              <span>Not caused by third-party API change or client edits to live credentials/Make scenarios</span>
            </label>

            <div className="font-semibold text-slate-800 pt-2">Routine Care vs. Change Order Signals</div>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" checked={minorCareTweak} onChange={(e) => setMinorCareTweak(e.target.checked)} />
              <span>Minor copy/link/timing tweak included under $650/mo care</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" checked={netNewFeature} onChange={(e) => setNetNewFeature(e.target.checked)} />
              <span>Adds a net-new page, extra Make scenario/workflow (+$750), or new integration</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" checked={changedLogic} onChange={(e) => setChangedLogic(e.target.checked)} />
              <span>Changes lead qualification, routing rules, or scheduling cadence after kickoff lock</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={postApprovalRedesign}
                onChange={(e) => setPostApprovalRedesign(e.target.checked)}
              />
              <span>Post-approval visual/layout redesign where original matched spec</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleEvaluate}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            Evaluate Scope & Generate Client Reply
          </button>
        </div>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-xs text-slate-500">Classification Result</div>
                <div className="text-lg font-semibold text-slate-900 mt-1">{result.classification}</div>
                <div className="text-xs font-mono text-slate-700 mt-1">{result.billingTreatment}</div>
              </div>
              <CodeCopyPanel
                title="Client Email Response (Copy-Paste Ready)"
                subtitle="Concise, matter-of-fact, boundary-clear"
                code={result.emailReply}
                maxHeightClass="max-h-60"
              />
              <CodeCopyPanel
                title="Slack / Quick-Note Version"
                code={result.slackReply}
                maxHeightClass="max-h-36"
              />
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-500">
              Select the scope conditions and click Evaluate Scope & Generate Client Reply to generate the boundary-clear email and Slack response.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CodeCopyPanel
          title="Deposit / Invoice Gate Reminder (Build Lock-In)"
          subtitle="Send right after SOW or Change Order approval before starting work"
          code={depositGateEmail}
          maxHeightClass="max-h-60"
        />
        <CodeCopyPanel
          title="Milestone 2 Final Payment & Go-Live Gate Reminder"
          subtitle="Send right after staging sign-off, before DNS cutover"
          code={milestone2GateEmail}
          maxHeightClass="max-h-60"
        />
      </div>
    </div>
  );
}
