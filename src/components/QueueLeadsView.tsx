import { useState } from 'react';
import { Upload, ArrowUpRight, Search } from 'lucide-react';
import type { Prospect, OutreachTouch } from '../types';
import { CodeCopyPanel } from './CodeCopyPanel';

interface QueueLeadsViewProps {
  prospects: Prospect[];
  touches: OutreachTouch[];
  dueNudges: Prospect[];
  freshHighScore: Prospect[];
  slackDigest: unknown;
  onRefresh: () => Promise<void>;
}

const SAMPLE_CSV = `BorrName,BorrStreet,BorrCity,BorrState,BorrZip,ApprovalDate,GrossApproval,NaicsCode,NaicsDescription,BusinessAge,google_review_count,website_url,has_booking_link,owner_name,owner_email
MAGNOLIA PLUMBING & DRAIN LLC,912 PEACHTREE ST NE,Atlanta,GA,30309,2026-02-18,620000,238220,Plumbing & HVAC,CHANGE OF OWNERSHIP,94,https://magnoliaplumbing.example.com,FALSE,Tanya Brooks,tanya@magnoliaplumbing.example.com
ATLANTA REALTY HOLDINGS LLC,100 MAIN ST,Atlanta,GA,30303,2026-01-10,1200000,531110,Lessors of Real Estate,EXISTING OR MORE THAN 2 YEARS OLD,12,,FALSE,,
TAMPA BAY AUTO SERVICE INC,4410 DALE MABRY HWY,Tampa,FL,33614,2025-10-04,485000,811111,General Automotive Repair,EXISTING OR MORE THAN 2 YEARS OLD,112,,FALSE,Carlos Mendez,carlos@tampabayauto.example.com`;

export function QueueLeadsView({
  prospects,
  touches,
  dueNudges,
  freshHighScore,
  slackDigest,
  onRefresh,
}: QueueLeadsViewProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'queue' | 'all' | 'airtable'>('queue');
  const [csvInput, setCsvInput] = useState(SAMPLE_CSV);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const handleRunProcess = async () => {
    setImporting(true);
    setImportSummary(null);
    try {
      const res = await fetch('/api/prospects/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvInput, program: '7a' }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportSummary(
          `Scanned ${data.scanned} rows · ${data.matched} passed deterministic filters · ${data.added} added · ${data.merged} merged`
        );
        await onRefresh();
      } else {
        setImportSummary(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const filteredProspects = prospects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.borr_name.toLowerCase().includes(q) ||
      p.borr_city.toLowerCase().includes(q) ||
      p.borr_state.toLowerCase().includes(q) ||
      p.campaign_track.toLowerCase().includes(q) ||
      p.outreach_status.toLowerCase().includes(q)
    );
  });

  const combinedQueue = [...dueNudges, ...freshHighScore];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('queue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Outbound Queue ({combinedQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Neon Prospects ({prospects.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('airtable')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'airtable' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Airtable CRM & Slack Digest
          </button>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'all' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter company, city, track..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-60"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowCsvImport((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showCsvImport ? 'Hide CSV Filter Runner' : 'Run SBA CSV Filter'}</span>
          </button>
        </div>
      </div>

      {showCsvImport && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Deterministic SBA FOIA Filter & Dedupe Runner
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Enforces 6–24 month approval window · $250k–$2.5M loan range · GA/FL/TX/NC/TN · Target NAICS · Passive shell exclusion · SHA-256 dedupe_id.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunProcess}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {importing ? 'Filtering...' : 'Filter & Upsert to Queue'}
            </button>
          </div>
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={5}
            className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {importSummary && (
            <p className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              {importSummary}
            </p>
          )}
        </div>
      )}

      {viewMode === 'queue' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Daily Outbound Queue (8:00 AM ET Make Schedule)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Due follow-up nudges prioritized ahead of uncontacted 60+ score operators
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {dueNudges.length} due · {freshHighScore.length} new 60+
              </span>
            </div>

            {combinedQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No due follow-ups or uncontacted 60+ leads in queue. Run the SBA CSV filter to add qualified operators.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Bucket</th>
                      <th className="py-2.5 px-4">Borrower & Location</th>
                      <th className="py-2.5 px-4">Track</th>
                      <th className="py-2.5 px-4 text-right">Score</th>
                      <th className="py-2.5 px-4 text-right">Loan</th>
                      <th className="py-2.5 px-4">Contact</th>
                      <th className="py-2.5 px-4">Friction Signals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {combinedQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <span
                            className={
                              item.queue_bucket === 'FOLLOWUP_DUE'
                                ? 'text-amber-700 font-medium'
                                : 'text-blue-700 font-medium'
                            }
                          >
                            {item.queue_bucket}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {item.borr_name}
                            {item.is_acquisition ? ' (ACQ)' : ''}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {item.borr_city}, {item.borr_state} · {item.program.toUpperCase()} · {item.total_touches} touches
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {item.campaign_track}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {item.computed_lead_score}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                          ${Math.round(item.gross_approval).toLocaleString('en-US')}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{item.best_email || 'Owner email pending'}</div>
                          <div className="font-mono text-slate-500 mt-0.5">{item.best_phone || 'No phone'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={item.friction_tags}>
                          {item.friction_tags}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Outreach Touches</h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">{touches.length} logged</span>
            </div>
            <div className="divide-y divide-slate-100">
              {touches.slice(0, 6).map((t) => {
                const prospect = prospects.find((p) => p.id === t.prospect_id);
                return (
                  <div key={t.id} className="px-5 py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">
                        {prospect?.borr_name || t.prospect_id}
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="font-mono text-slate-600">{t.direction} / {t.channel}</span>
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="font-mono text-slate-700">{t.outcome}</span>
                      </div>
                      <p className="text-slate-600 mt-1 truncate">
                        {t.reply_excerpt || t.message_summary}
                      </p>
                    </div>
                    <span className="font-mono text-slate-500 whitespace-nowrap shrink-0 tabular-nums">
                      {t.occurred_at.slice(0, 16).replace('T', ' ')} UTC
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'all' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Company</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4 text-right">Reviews</th>
                  <th className="py-2.5 px-4 text-right">Speed</th>
                  <th className="py-2.5 px-4">Airtable ID</th>
                  <th className="py-2.5 px-4">Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProspects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{p.borr_name}</div>
                      <div className="text-slate-500 mt-0.5 font-mono">{p.dedupe_id} · {p.campaign_track}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {p.borr_city}, {p.borr_state}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{p.outreach_status}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                      {p.computed_lead_score}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {p.google_review_count} ({p.google_rating ?? '—'})
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {p.response_time_ms ? `${p.response_time_ms}ms` : p.site_status}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.airtable_record_id}</td>
                    <td className="py-3 px-4">
                      {p.website_url ? (
                        <a
                          href={p.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <span>Audit</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'airtable' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Airtable CRM & Client View Mapping
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Neon PostgreSQL remains the source of truth for scoring and logs; Airtable mirrors client-facing pipeline status and care views.
              </p>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Airtable Field (SBA Prospects)</th>
                  <th className="py-2 pr-3">Neon Source Column</th>
                  <th className="py-2">Sync Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                <tr>
                  <td className="py-2 pr-3">Dedupe ID (Merge Key)</td>
                  <td className="py-2 pr-3">sba_prospects.dedupe_id</td>
                  <td className="py-2">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Company Name / Track</td>
                  <td className="py-2 pr-3">borr_name / campaign_track</td>
                  <td className="py-2">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Lead Score</td>
                  <td className="py-2 pr-3">computed_lead_score</td>
                  <td className="py-2">Neon → Airtable</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Outreach Status</td>
                  <td className="py-2 pr-3">outreach_status</td>
                  <td className="py-2">Make Inbound → Both</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Latest Outcome / Excerpt</td>
                  <td className="py-2 pr-3">v_sba_prospect_engagement</td>
                  <td className="py-2">Make Inbound → Both</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CodeCopyPanel
            title="Slack Block Kit Morning Digest Payload (#sba-outreach)"
            subtitle="Generated deterministically from Make Morning Queue scenario"
            code={JSON.stringify(slackDigest, null, 2)}
            maxHeightClass="max-h-80"
          />
        </div>
      )}
    </div>
  );
}
