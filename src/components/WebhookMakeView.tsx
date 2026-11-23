import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { BlueprintsBundle, WebhookDelivery, WebhookStep } from '../types';
import { CodeCopyPanel } from './CodeCopyPanel';

interface WebhookMakeViewProps {
  blueprints: BlueprintsBundle | null;
  onRefresh: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error') => void;
}

export function WebhookMakeView({ blueprints, onRefresh, onToast }: WebhookMakeViewProps) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [fromEmail, setFromEmail] = useState('elena@sunbeltfleet.example.com');
  const [fromPhone, setFromPhone] = useState('+17705550188');
  const [secretHeader, setSecretHeader] = useState('demo-make-shared-secret');
  const [replyText, setReplyText] = useState(
    'Swamped with shop intake this week, check back next month once our new manager settles in.'
  );
  const [submitting, setSubmitting] = useState(false);

  const [activeOutputTab, setActiveOutputTab] = useState<'normalized' | 'airtable' | 'slack' | 'blueprints'>('normalized');
  const [selectedBlueprint, setSelectedBlueprint] = useState<'inbound' | 'morning' | 'watcher' | 'worker'>('inbound');

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await fetch('/api/webhook/deliveries');
      if (!res.ok) return;
      const data = await res.json();
      const list: WebhookDelivery[] = data.deliveries || [];
      setDeliveries(list);
      setSelectedDeliveryId((prev) => prev || list[0]?.id || null);
    } catch {
      // Keep UI responsive
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId) || deliveries[0] || null;

  const dispatchPayload = async (
    override?: {
      channel: 'email' | 'sms';
      email: string;
      phone: string;
      secret: string;
      text: string;
    }
  ) => {
    setSubmitting(true);
    const ch = override?.channel ?? channel;
    const em = override?.email ?? fromEmail;
    const ph = override?.phone ?? fromPhone;
    const sec = override?.secret ?? secretHeader;
    const txt = override?.text ?? replyText;

    try {
      const payload =
        ch === 'email'
          ? {
              channel: 'email',
              from_email: em,
              subject: 'Re: Intake automation teardown',
              text: txt,
              event_id: `sim_${Date.now()}`,
            }
          : {
              channel: 'sms',
              from_phone: ph,
              Body: txt,
              MessageSid: `SM_${Date.now()}`,
            };

      const res = await fetch('/api/webhook/inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': sec,
        },
        body: JSON.stringify(payload),
      });

      const listRes = await fetch('/api/webhook/deliveries');
      if (listRes.ok) {
        const listData = await listRes.json();
        const updatedList: WebhookDelivery[] = listData.deliveries || [];
        setDeliveries(updatedList);
        if (updatedList[0]) setSelectedDeliveryId(updatedList[0].id);
      }

      if (res.status === 401) {
        onToast('Blocked at X-Webhook-Secret gate (HTTP 401)', 'error');
      } else {
        onToast('Webhook normalized, classified & synced to Neon + Airtable + Slack');
      }
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaySelected = async () => {
    if (!selectedDelivery) return;
    const raw = selectedDelivery.rawPayload;
    const ch: 'email' | 'sms' = selectedDelivery.channel === 'sms' ? 'sms' : 'email';
    const emailVal = String(raw.from_email || fromEmail);
    const phoneVal = String(raw.from_phone || fromPhone);
    const textVal = String(raw.text || raw.Body || replyText);
    setChannel(ch);
    if (ch === 'email') setFromEmail(emailVal);
    else setFromPhone(phoneVal);
    setReplyText(textVal);
    setSecretHeader(selectedDelivery.secretUsed || 'demo-make-shared-secret');
    await dispatchPayload({
      channel: ch,
      email: emailVal,
      phone: phoneVal,
      secret: selectedDelivery.secretUsed || 'demo-make-shared-secret',
      text: textVal,
    });
  };

  const activeSteps: WebhookStep[] = selectedDelivery?.responseBody?.steps || [
    { id: 'worker', label: 'CF Worker Normalize', status: 'passed', duration_ms: 9, detail: 'Normalized ingress payload' },
    { id: 'secret', label: 'X-Webhook-Secret Gate', status: 'passed', duration_ms: 3, detail: 'Shared secret verified' },
    { id: 'classify', label: 'Deterministic Classifier', status: 'passed', duration_ms: 4, detail: selectedDelivery?.outcome || 'replied_interested' },
    { id: 'match', label: 'Neon Prospect Match', status: 'passed', duration_ms: 38, detail: selectedDelivery?.matchedCompany || 'Matched borrower' },
    { id: 'sync', label: 'Touch & Airtable Sync', status: 'passed', duration_ms: 74, detail: 'Inserted touch + patched Airtable' },
    { id: 'slack', label: 'Slack Alert', status: 'passed', duration_ms: 41, detail: 'Posted to #sba-outreach' },
  ];

  const stepIcon = (status: WebhookStep['status']) => {
    if (status === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    if (status === 'warning') return <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
    if (status === 'failed') return <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
    return <MinusCircle className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  const blueprintDoc = () => {
    if (!blueprints) return { title: 'Loading...', subtitle: '', code: '' };
    if (selectedBlueprint === 'morning') {
      return {
        title: 'sba-make-morning-queue-scenario.json',
        subtitle: 'Make Schedule (8am ET M–F) → Neon Postgres → Slack Block Kit → automation_runs',
        code: blueprints.make.morningQueue,
      };
    }
    if (selectedBlueprint === 'inbound') {
      return {
        title: 'sba-make-inbound-reply-scenario.json',
        subtitle: 'Make Custom Webhook (X-Webhook-Secret gate) → Deterministic Classifier → Neon + Airtable + Slack',
        code: blueprints.make.inboundReply,
      };
    }
    if (selectedBlueprint === 'watcher') {
      return {
        title: 'sba-make-error-watcher-scenario.json',
        subtitle: 'Make Error Handler → Neon automation_runs → Slack #ops-alerts → Airtable Care Incidents',
        code: blueprints.make.errorWatcher,
      };
    }
    return {
      title: 'sba-webhook-relay-worker-normalized.js',
      subtitle: 'Cloudflare Worker edge ingress: JSON / Twilio form normalizer + X-Webhook-Secret injection',
      code: blueprints.worker.normalizedWorker,
    };
  };

  const doc = blueprintDoc();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Pane: Delivery History + Presets */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Delivery Log ({deliveries.length})
            </h3>
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[360px] overflow-y-auto">
            {deliveries.map((del) => {
              const isSelected = selectedDelivery?.id === del.id;
              return (
                <button
                  key={del.id}
                  type="button"
                  onClick={() => setSelectedDeliveryId(del.id)}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/35'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono">
                    <span
                      className={
                        del.httpStatus === 200
                          ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                          : 'text-rose-600 dark:text-rose-400 font-semibold'
                      }
                    >
                      HTTP {del.httpStatus}
                    </span>
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {del.occurredAt.slice(11, 19)} UTC
                    </span>
                  </div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                    {del.matchedCompany || del.sender}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    {del.channel} · {del.outcome}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Quick Test Payloads
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setSecretHeader('demo-make-shared-secret');
                setReplyText('Yes, send over two times for a 15-minute call this Thursday.');
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
            >
              Sample: Interested Reply
            </button>
            <button
              type="button"
              onClick={() => {
                setSecretHeader('demo-make-shared-secret');
                setReplyText('Too busy this week, reach out next quarter.');
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
            >
              Sample: Not Now (Snooze)
            </button>
            <button
              type="button"
              onClick={() => {
                setSecretHeader('demo-make-shared-secret');
                setReplyText('Please remove me from your list, not interested.');
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
            >
              Sample: Not Fit / Opt-Out
            </button>
            <button
              type="button"
              onClick={() => setSecretHeader('wrong-secret-test')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-rose-200 dark:border-rose-900 cursor-pointer"
            >
              Test 401 Secret Mismatch
            </button>
          </div>
        </div>
      </div>

      {/* Center Pane: Payload Dispatcher + 6-Step Execution Trace */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Inbound Edge Simulator
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                CF Worker normalization → X-Webhook-Secret gate → Deterministic classifier
              </p>
            </div>
            {selectedDelivery && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleReplaySelected()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Selected</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'email' | 'sms')}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              >
                <option value="email">Email Reply</option>
                <option value="sms">SMS / Twilio Reply</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                X-Webhook-Secret Header
              </label>
              <input
                type="text"
                value={secretHeader}
                onChange={(e) => setSecretHeader(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
          </div>

          {channel === 'email' ? (
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sender Email</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sender Phone</label>
              <input
                type="text"
                value={fromPhone}
                onChange={(e) => setFromPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Reply Body</label>
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md"
            />
          </div>

          <button
            type="button"
            onClick={() => void dispatchPayload()}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Executing Pipeline...' : 'Send Normalized Inbound Event'}</span>
          </button>
        </div>

        {/* 6-Step Visual Pipeline Trace */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              6-Step Pipeline Trace
            </h3>
            {selectedDelivery && (
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {selectedDelivery.id}
              </span>
            )}
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activeSteps.map((step, idx) => (
              <div key={step.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  {stepIcon(step.status)}
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {idx + 1}. {step.label}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {step.detail}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                  {step.duration_ms}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Pane: Tabbed Normalized / Airtable / Slack / Blueprints */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
          {(
            [
              ['normalized', 'Normalized'],
              ['airtable', 'Airtable Patch'],
              ['slack', 'Slack Alert'],
              ['blueprints', 'Blueprints'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveOutputTab(key)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeOutputTab === key
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeOutputTab === 'normalized' && (
          <CodeCopyPanel
            title="Normalized Payload & Classifier Output"
            subtitle={selectedDelivery ? `HTTP ${selectedDelivery.httpStatus} · ${selectedDelivery.sender}` : undefined}
            code={JSON.stringify(selectedDelivery?.responseBody ?? { message: 'Select a delivery event' }, null, 2)}
            maxHeightClass="max-h-[540px]"
          />
        )}

        {activeOutputTab === 'airtable' && (
          <CodeCopyPanel
            title="Airtable CRM Upsert Patch"
            subtitle="Mirrors outreach status & reply excerpt to client view"
            code={JSON.stringify(
              selectedDelivery?.responseBody?.airtableUpdate ?? {
                note: 'No Airtable patch emitted for this delivery (401 or unmatched sender).',
              },
              null,
              2
            )}
            maxHeightClass="max-h-[540px]"
          />
        )}

        {activeOutputTab === 'slack' && (
          <CodeCopyPanel
            title="Slack Notification Payload (#sba-outreach)"
            subtitle="Posted automatically by Make inbound scenario"
            code={JSON.stringify(
              selectedDelivery?.responseBody?.slackAlert ?? {
                note: 'No Slack alert emitted for rejected 401 requests.',
              },
              null,
              2
            )}
            maxHeightClass="max-h-[540px]"
          />
        )}

        {activeOutputTab === 'blueprints' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['inbound', 'Make: Inbound'],
                  ['morning', 'Make: Morning'],
                  ['watcher', 'Make: Watcher'],
                  ['worker', 'CF Worker'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedBlueprint(k)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded border cursor-pointer ${
                    selectedBlueprint === k
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <CodeCopyPanel title={doc.title} subtitle={doc.subtitle} code={doc.code} maxHeightClass="max-h-[490px]" />
          </div>
        )}
      </div>
    </div>
  );
}
