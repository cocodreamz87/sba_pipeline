import { useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import type { BlueprintsBundle } from '../types';
import { CodeCopyPanel } from './CodeCopyPanel';

interface WebhookMakeViewProps {
  blueprints: BlueprintsBundle | null;
  onRefresh: () => Promise<void>;
}

export function WebhookMakeView({ blueprints, onRefresh }: WebhookMakeViewProps) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [fromEmail, setFromEmail] = useState('elena@sunbeltfleet.example.com');
  const [fromPhone, setFromPhone] = useState('+17705550188');
  const [secretHeader, setSecretHeader] = useState('demo-make-shared-secret');
  const [replyText, setReplyText] = useState(
    'Swamped with shop intake this week, check back next month once our new manager settles in.'
  );
  const [responseOut, setResponseOut] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<'morning' | 'inbound' | 'watcher' | 'worker'>('inbound');

  const handleTestWebhook = async () => {
    setSubmitting(true);
    try {
      const payload =
        channel === 'email'
          ? {
              channel: 'email',
              from_email: fromEmail,
              subject: 'Re: Intake automation teardown',
              text: replyText,
              event_id: `sim_${Date.now()}`,
            }
          : {
              channel: 'sms',
              from_phone: fromPhone,
              Body: replyText,
              MessageSid: `SM_${Date.now()}`,
            };

      const res = await fetch('/api/webhook/inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secretHeader,
        },
        body: JSON.stringify(payload),
      });
      setResponseStatus(res.status);
      const data = await res.json();
      setResponseOut(JSON.stringify(data, null, 2));
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const activeBlueprint = () => {
    if (!blueprints) return { title: 'Loading...', subtitle: '', code: '' };
    if (selectedDoc === 'morning') {
      return {
        title: 'sba-make-morning-queue-scenario.json',
        subtitle: 'Make Schedule (8am ET M–F) → Neon Postgres → Slack Block Kit → automation_runs',
        code: blueprints.make.morningQueue,
      };
    }
    if (selectedDoc === 'inbound') {
      return {
        title: 'sba-make-inbound-reply-scenario.json',
        subtitle: 'Make Custom Webhook (X-Webhook-Secret gate) → Deterministic Classifier → Neon + Airtable + Slack',
        code: blueprints.make.inboundReply,
      };
    }
    if (selectedDoc === 'watcher') {
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

  const doc = activeBlueprint();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Cloudflare Worker + Make Inbound Reply Tester
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tests X-Webhook-Secret gating (401 on mismatch), deterministic classification (zero AI calls), Neon touch insert, and Airtable + Slack payloads.
              </p>
            </div>
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'email' | 'sms')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md"
              >
                <option value="email">Email Reply</option>
                <option value="sms">SMS / Twilio Reply</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                X-Webhook-Secret Header
              </label>
              <input
                type="text"
                value={secretHeader}
                onChange={(e) => setSecretHeader(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-md"
              />
            </div>
          </div>

          {channel === 'email' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sender Email</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-md"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sender Phone</label>
              <input
                type="text"
                value={fromPhone}
                onChange={(e) => setFromPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-md"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reply Body</label>
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => setReplyText('Yes, send over two times for a 15-minute call this Thursday.')}
                className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Sample: Interested
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setReplyText('Too busy this week, reach out next quarter.')}
                className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Sample: Not Now
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setReplyText('Please remove me from your list, not interested.')}
                className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Sample: Not Fit
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setSecretHeader('wrong-secret-test')}
                className="text-xs text-red-700 hover:text-red-900 underline cursor-pointer"
              >
                Test 401 Reject
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestWebhook}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Dispatching...' : 'Send Normalized Inbound Event'}</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Webhook Execution Result</h4>
            {responseStatus !== null && (
              <span
                className={`text-xs font-mono font-semibold ${
                  responseStatus === 200 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                HTTP {responseStatus}
              </span>
            )}
          </div>
          <pre className="p-4 text-xs font-mono text-slate-800 overflow-auto flex-1 max-h-96">
            <code>
              {responseOut ||
                'Dispatch an inbound event to inspect deterministic classification, Neon touch insertion, Airtable CRM patch, and Slack alert payload.'}
            </code>
          </pre>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              ['inbound', 'Make: Inbound Reply'],
              ['morning', 'Make: 8am Morning Queue'],
              ['watcher', 'Make: Error Watcher'],
              ['worker', 'CF Worker: Normalized Ingress'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDoc(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedDoc === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <CodeCopyPanel title={doc.title} subtitle={doc.subtitle} code={doc.code} maxHeightClass="max-h-[420px]" />
      </div>
    </div>
  );
}
