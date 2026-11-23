import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { Pool } from 'pg';
import { normalizeMakeErrorPayload } from './sba-make-error-normalize.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// ============================================================================
// 1. NEON POSTGRESQL CONNECTION (SAFE FALLBACK TO IN-MEMORY STORE)
// ============================================================================
let pool: Pool | null = null;
let neonConnected = false;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });
    await pool.query('select 1');
    neonConnected = true;
    console.log('[NEON] Connected to PostgreSQL');
  } catch (err) {
    console.warn('[NEON] Connection unavailable, using in-memory store:', (err as Error).message);
    pool = null;
  }
}

// ============================================================================
// 2. DETERMINISTIC TYPES & SEED DATA (MIRRORS NEON SCHEMA)
// ============================================================================
interface ProspectRecord {
  id: string;
  dedupe_id: string;
  program: '7a' | '504' | '7a+504';
  loan_count: number;
  borr_name: string;
  borr_street: string;
  borr_city: string;
  borr_state: string;
  borr_zip: string;
  approval_date: string;
  gross_approval: number;
  naics_code: string;
  naics_description: string;
  is_acquisition: boolean;
  google_rating: number | null;
  google_review_count: number;
  google_phone: string;
  website_url: string;
  normalized_domain: string;
  site_status: string;
  response_time_ms: number | null;
  has_booking_link: boolean;
  has_form_or_intake: boolean;
  mailto_only_risk: boolean;
  missing_viewport_meta: boolean;
  friction_tags: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  computed_lead_score: number;
  campaign_track: string;
  outreach_status: string;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  airtable_record_id: string;
}

interface OutreachTouch {
  id: string;
  prospect_id: string;
  external_event_id: string;
  channel: string;
  direction: 'outbound' | 'inbound';
  sequence_name: string;
  subject_line: string;
  message_summary: string;
  outcome: string;
  reply_sentiment: string;
  reply_excerpt: string;
  occurred_at: string;
}

interface AutomationRun {
  id: string;
  execution_id: string;
  client_slug: string;
  workflow_id: string;
  workflow_name: string;
  failed_node: string;
  status: 'success' | 'ok' | 'completed' | 'error' | 'failed' | 'timeout' | 'rejected';
  duration_ms: number;
  records_processed: number;
  error_message: string;
  execution_url: string;
  created_at: string;
}

interface MonthlyCareLog {
  id: string;
  client_slug: string;
  care_month: string;
  site_uptime_pct: number;
  downtime_incidents_count: number;
  downtime_notes: string;
  wf1_lead_runs: number;
  wf2_booking_runs: number;
  wf3_followup_runs: number;
  total_workflow_runs: number;
  failed_runs_count: number;
  dropped_or_retried_count: number;
  top_error_summary: string;
  care_tweaks_count: number;
  care_tweaks_summary: string;
  change_orders_count: number;
  change_order_revenue: number;
  updated_at: string;
}

function computeLeadScore(p: Partial<ProspectRecord>): number {
  let score = 0;
  if (p.site_status === 'NO_WEBSITE') score = 80;
  else if (p.site_status === 'TIMEOUT' || p.site_status === 'FETCH_ERROR') score = 70;
  else {
    score = 40;
    if (!p.has_booking_link) score += 25;
    if (p.response_time_ms && p.response_time_ms >= 2500) score += 15;
    if (p.mailto_only_risk) score += 15;
    if (!p.has_form_or_intake && !p.mailto_only_risk) score += 10;
    if (p.missing_viewport_meta) score += 10;
  }
  if ((p.google_review_count || 0) >= 50 && !p.has_booking_link) score += 10;
  if (p.is_acquisition) score += 5;
  if ((p.gross_approval || 0) >= 500_000) score += 5;
  return Math.min(100, Math.max(0, score));
}

function assignCampaignTrack(p: Partial<ProspectRecord>): string {
  if (p.is_acquisition) return 'ACQUISITION_NEW_OPERATOR';
  if ((p.google_review_count || 0) >= 50 && !p.has_booking_link) return 'HIGH_REVIEW_LEAKY_FUNNEL';
  if (String(p.program || '').includes('504')) return 'EXPANSION_504_OPS';
  return 'STANDARD_SBA_INTAKE';
}

function extractDomain(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/^www\./, '');
}

const rawSeedProspects: ProspectRecord[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    dedupe_id: 'a91f4c028e11b201',
    program: '7a',
    loan_count: 1,
    borr_name: 'PEACHTREE MECHANICAL HVAC LLC',
    borr_street: '1420 MARIETTA BLVD NW',
    borr_city: 'Atlanta',
    borr_state: 'GA',
    borr_zip: '30318',
    approval_date: '2025-11-14',
    gross_approval: 940000,
    naics_code: '238220',
    naics_description: 'Plumbing, Heating, and Air-Conditioning Contractors',
    is_acquisition: true,
    google_rating: 4.8,
    google_review_count: 142,
    google_phone: '+14045550148',
    website_url: 'https://peachtreemech.example.com',
    normalized_domain: 'peachtreemech.example.com',
    site_status: 'HTTP_200',
    response_time_ms: 3180,
    has_booking_link: false,
    has_form_or_intake: true,
    mailto_only_risk: false,
    missing_viewport_meta: true,
    friction_tags: 'MISSING_INSTANT_BOOKING | SLOW_SERVER_RESPONSE | MISSING_MOBILE_VIEWPORT',
    owner_name: 'Marcus Vance',
    owner_email: 'marcus@peachtreemech.example.com',
    owner_phone: '+14045550199',
    computed_lead_score: 0,
    campaign_track: '',
    outreach_status: 'contacted',
    last_contacted_at: '2026-11-20T14:15:00Z',
    next_followup_at: '2026-11-23T15:00:00Z',
    airtable_record_id: 'recA101Peachtree',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    dedupe_id: 'b72d91e404a8c302',
    program: '7a+504',
    loan_count: 2,
    borr_name: 'SUNBELT FLEET & COLLISION INC',
    borr_street: '4801 BUFORD HWY NE',
    borr_city: 'Chamblee',
    borr_state: 'GA',
    borr_zip: '30341',
    approval_date: '2026-01-22',
    gross_approval: 1380000,
    naics_code: '811121',
    naics_description: 'Automotive Body, Paint, and Interior Repair',
    is_acquisition: true,
    google_rating: 4.6,
    google_review_count: 89,
    google_phone: '+17705550123',
    website_url: 'https://sunbeltfleet.example.com',
    normalized_domain: 'sunbeltfleet.example.com',
    site_status: 'HTTP_200',
    response_time_ms: 1420,
    has_booking_link: false,
    has_form_or_intake: false,
    mailto_only_risk: true,
    missing_viewport_meta: false,
    friction_tags: 'MISSING_INSTANT_BOOKING | MAILTO_ONLY_INTAKE',
    owner_name: 'Elena Rostova',
    owner_email: 'elena@sunbeltfleet.example.com',
    owner_phone: '+17705550188',
    computed_lead_score: 0,
    campaign_track: '',
    outreach_status: 'ready',
    last_contacted_at: null,
    next_followup_at: null,
    airtable_record_id: 'recB202Sunbelt',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    dedupe_id: 'c45e19a870c2f903',
    program: '504',
    loan_count: 1,
    borr_name: 'GULF COAST COMMERCIAL CLEANING CO',
    borr_street: '2190 WESTHEIMER RD',
    borr_city: 'Houston',
    borr_state: 'TX',
    borr_zip: '77098',
    approval_date: '2025-09-08',
    gross_approval: 685000,
    naics_code: '561720',
    naics_description: 'Janitorial Services',
    is_acquisition: false,
    google_rating: 4.9,
    google_review_count: 118,
    google_phone: '+17135550164',
    website_url: '',
    normalized_domain: '',
    site_status: 'NO_WEBSITE',
    response_time_ms: null,
    has_booking_link: false,
    has_form_or_intake: false,
    mailto_only_risk: false,
    missing_viewport_meta: false,
    friction_tags: 'NO_WEBSITE_OPPORTUNITY',
    owner_name: 'Derrick Holloway',
    owner_email: 'derrick@gulfcoastclean.example.com',
    owner_phone: '+17135550171',
    computed_lead_score: 0,
    campaign_track: '',
    outreach_status: 'enriched',
    last_contacted_at: null,
    next_followup_at: null,
    airtable_record_id: 'recC303GulfCoast',
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    dedupe_id: 'd19c88f120b7e404',
    program: '7a',
    loan_count: 1,
    borr_name: 'CAROLINA SPINE & REHAB CLINIC PLLC',
    borr_street: '815 PROVIDENCE RD',
    borr_city: 'Charlotte',
    borr_state: 'NC',
    borr_zip: '28207',
    approval_date: '2026-03-11',
    gross_approval: 520000,
    naics_code: '621340',
    naics_description: 'Offices of Physical, Occupational and Speech Therapists',
    is_acquisition: false,
    google_rating: 4.7,
    google_review_count: 74,
    google_phone: '+17045550132',
    website_url: 'https://carolinaspine.example.com',
    normalized_domain: 'carolinaspine.example.com',
    site_status: 'HTTP_200',
    response_time_ms: 2740,
    has_booking_link: false,
    has_form_or_intake: true,
    mailto_only_risk: false,
    missing_viewport_meta: false,
    friction_tags: 'MISSING_INSTANT_BOOKING | SLOW_SERVER_RESPONSE',
    owner_name: 'Dr. Priya Nair',
    owner_email: 'priya@carolinaspine.example.com',
    owner_phone: '+17045550190',
    computed_lead_score: 0,
    campaign_track: '',
    outreach_status: 'contacted',
    last_contacted_at: '2026-11-18T16:40:00Z',
    next_followup_at: '2026-11-22T14:00:00Z',
    airtable_record_id: 'recD404Carolina',
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    dedupe_id: 'e88b03c511d9a505',
    program: '504',
    loan_count: 1,
    borr_name: 'PALMETTO DENTAL ASSOCIATES PA',
    borr_street: '330 KING ST',
    borr_city: 'Tampa',
    borr_state: 'FL',
    borr_zip: '33602',
    approval_date: '2026-02-05',
    gross_approval: 1120000,
    naics_code: '621210',
    naics_description: 'Offices of Dentists',
    is_acquisition: true,
    google_rating: 4.9,
    google_review_count: 204,
    google_phone: '+18135550145',
    website_url: 'https://palmettodental.example.com',
    normalized_domain: 'palmettodental.example.com',
    site_status: 'HTTP_200',
    response_time_ms: 910,
    has_booking_link: true,
    has_form_or_intake: true,
    mailto_only_risk: false,
    missing_viewport_meta: false,
    friction_tags: 'BASELINE_OK',
    owner_name: 'Dr. Jordan Reyes',
    owner_email: 'jordan@palmettodental.example.com',
    owner_phone: '+18135550177',
    computed_lead_score: 0,
    campaign_track: '',
    outreach_status: 'replied',
    last_contacted_at: '2026-11-21T10:15:00Z',
    next_followup_at: null,
    airtable_record_id: 'recE505Palmetto',
  },
];

const seedProspects: ProspectRecord[] = rawSeedProspects.map((p) => ({
  ...p,
  computed_lead_score: computeLeadScore(p),
  campaign_track: assignCampaignTrack(p),
}));

const seedTouches: OutreachTouch[] = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    prospect_id: '11111111-1111-4111-8111-111111111101',
    external_event_id: 'out_track_a_email1_01',
    channel: 'email',
    direction: 'outbound',
    sequence_name: 'TRACK_A_ACQUISITION',
    subject_line: 'PEACHTREE MECHANICAL HVAC LLC after the transition / web + intake',
    message_summary: 'Sent Email 1 + 90-sec Loom teardown link highlighting slow mobile load (3.18s) and missing instant booking.',
    outcome: 'sent',
    reply_sentiment: '',
    reply_excerpt: '',
    occurred_at: '2026-11-20T14:15:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    prospect_id: '11111111-1111-4111-8111-111111111104',
    external_event_id: 'out_track_b_email1_02',
    channel: 'email',
    direction: 'outbound',
    sequence_name: 'TRACK_B_LEAKY_FUNNEL',
    subject_line: '74 Google reviews on Carolina Spine — quick intake note',
    message_summary: 'Sent initial teardown email noting 2.74s response time and static callback-only form.',
    outcome: 'sent',
    reply_sentiment: '',
    reply_excerpt: '',
    occurred_at: '2026-11-18T16:40:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    prospect_id: '11111111-1111-4111-8111-111111111105',
    external_event_id: 'inbound_email_palmetto_03',
    channel: 'inbound_reply',
    direction: 'inbound',
    sequence_name: 'INBOUND_WEBHOOK',
    subject_line: 'Re: Palmetto Dental intake workflow',
    message_summary: 'Inbound EMAIL reply from jordan@palmettodental.example.com',
    outcome: 'replied_interested',
    reply_sentiment: 'positive',
    reply_excerpt: 'Watched the Loom — our front desk is still copying online forms into Dentrix manually. Send two times this week.',
    occurred_at: '2026-11-21T10:15:00Z',
  },
];

const seedRuns: AutomationRun[] = [
  {
    id: '33333333-3333-4333-8333-333333333301',
    execution_id: 'mk_exec_9041821',
    client_slug: 'apex_hvac',
    workflow_id: 'scn_wf1_8810',
    workflow_name: 'wf1_lead_routing',
    failed_node: '',
    status: 'success',
    duration_ms: 420,
    records_processed: 14,
    error_message: '',
    execution_url: 'https://us1.make.com/1042/scenarios/8810/logs/9041821',
    created_at: '2026-11-22T15:10:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333302',
    execution_id: 'mk_exec_9041990',
    client_slug: 'apex_hvac',
    workflow_id: 'scn_wf2_8812',
    workflow_name: 'wf2_booking_reminders',
    failed_node: 'HTTP — SMS Provider Dispatch',
    status: 'timeout',
    duration_ms: 8004,
    records_processed: 1,
    error_message: 'Upstream SMS webhook timeout after 8000ms (retried and succeeded cleanly)',
    execution_url: 'https://us1.make.com/1042/scenarios/8812/logs/9041990',
    created_at: '2026-11-22T17:45:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333303',
    execution_id: 'mk_exec_9042105',
    client_slug: 'apex_hvac',
    workflow_id: 'scn_wf3_8815',
    workflow_name: 'wf3_followup_loop',
    failed_node: '',
    status: 'success',
    duration_ms: 615,
    records_processed: 9,
    error_message: '',
    execution_url: 'https://us1.make.com/1042/scenarios/8815/logs/9042105',
    created_at: '2026-11-23T08:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333304',
    execution_id: 'mk_exec_9042211',
    client_slug: 'coco_club_live',
    workflow_id: 'scn_morning_q_9001',
    workflow_name: 'wf1_morning_queue_slack_digest',
    failed_node: '',
    status: 'success',
    duration_ms: 540,
    records_processed: 4,
    error_message: '',
    execution_url: 'https://us1.make.com/1042/scenarios/9001/logs/9042211',
    created_at: '2026-11-23T13:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333305',
    execution_id: 'mk_exec_9042309',
    client_slug: 'sunbelt_fleet',
    workflow_id: 'scn_wf1_8904',
    workflow_name: 'wf1_speed_to_lead',
    failed_node: 'Airtable — Upsert Lead Record',
    status: 'failed',
    duration_ms: 1840,
    records_processed: 0,
    error_message: '422 INVALID_MULTIPLE_CHOICE_OPTIONS: Status "Estimate Requested" missing in Airtable table',
    execution_url: 'https://us1.make.com/1042/scenarios/8904/logs/9042309',
    created_at: '2026-11-23T09:12:00Z',
  },
];

const seedCareLogs: MonthlyCareLog[] = [
  {
    id: '44444444-4444-4444-8444-444444444401',
    client_slug: 'apex_hvac',
    care_month: '2026-11-01',
    site_uptime_pct: 99.96,
    downtime_incidents_count: 0,
    downtime_notes: 'None',
    wf1_lead_runs: 48,
    wf2_booking_runs: 36,
    wf3_followup_runs: 29,
    total_workflow_runs: 113,
    failed_runs_count: 1,
    dropped_or_retried_count: 1,
    top_error_summary: 'Upstream SMS webhook timeout after 8000ms (retried and succeeded cleanly)',
    care_tweaks_count: 2,
    care_tweaks_summary: 'Updated booking reminder lead time from 24h to 18h; clarified service-area copy on /quote',
    change_orders_count: 0,
    change_order_revenue: 0,
    updated_at: '2026-11-23T09:00:00Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444402',
    client_slug: 'sunbelt_fleet',
    care_month: '2026-11-01',
    site_uptime_pct: 99.91,
    downtime_incidents_count: 0,
    downtime_notes: 'None',
    wf1_lead_runs: 31,
    wf2_booking_runs: 19,
    wf3_followup_runs: 14,
    total_workflow_runs: 64,
    failed_runs_count: 1,
    dropped_or_retried_count: 0,
    top_error_summary: '422 INVALID_MULTIPLE_CHOICE_OPTIONS: Status "Estimate Requested" missing in Airtable table',
    care_tweaks_count: 1,
    care_tweaks_summary: 'Adjusted commercial fleet form validation for DOT number field',
    change_orders_count: 1,
    change_order_revenue: 750,
    updated_at: '2026-11-23T09:15:00Z',
  },
];

// In-memory state
const state = {
  prospects: [...seedProspects],
  touches: [...seedTouches],
  runs: [...seedRuns],
  careLogs: [...seedCareLogs],
};

// ============================================================================
// 3. DETERMINISTIC HELPERS (WEBHOOK NORMALIZATION, CLASSIFICATION, QUEUE)
// ============================================================================
function cleanStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractEmail(raw: Record<string, unknown>): string {
  const envelope = raw.envelope as Record<string, unknown> | undefined;
  const candidate = cleanStr(
    raw.from_email ||
      raw.sender_email ||
      raw.email ||
      envelope?.from ||
      (typeof raw.from === 'string' && raw.from.includes('@') ? raw.from : '') ||
      (typeof raw.sender === 'string' && raw.sender.includes('@') ? raw.sender : '')
  );
  const match = candidate.match(/<([^>\s]+@[^>\s]+)>/) || candidate.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/);
  return (match ? match[1] : candidate).trim().toLowerCase();
}

function extractPhone(raw: Record<string, unknown>): string {
  const candidate = cleanStr(
    raw.from_phone ||
      raw.sender_phone ||
      raw.phone ||
      raw.From ||
      raw.from_number ||
      (typeof raw.from === 'string' && !raw.from.includes('@') ? raw.from : '')
  );
  const digits = candidate.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function classifyInboundReply(bodyText: string): { outcome: string; sentiment: string } {
  const lowerBody = bodyText.toLowerCase();
  const notFitPatterns = [
    /\bunsubscribe\b/i,
    /\bstop\b/i,
    /\bremove me\b/i,
    /\bnot interested\b/i,
    /\bno thanks\b/i,
    /\bwrong person\b/i,
    /\balready have an agency\b/i,
    /\bdo not contact\b/i,
  ];
  const notNowPatterns = [
    /\bnot right now\b/i,
    /\bnext quarter\b/i,
    /\bnext month\b/i,
    /\btoo busy\b/i,
    /\bswamped\b/i,
    /\breach out in\b/i,
    /\bcheck back\b/i,
    /\bbudget\b.*\b(tight|later|next year)\b/i,
  ];

  if (notFitPatterns.some((rx) => rx.test(lowerBody))) {
    return { outcome: 'replied_not_fit', sentiment: 'negative' };
  }
  if (notNowPatterns.some((rx) => rx.test(lowerBody))) {
    return { outcome: 'replied_not_now', sentiment: 'neutral' };
  }
  return { outcome: 'replied_interested', sentiment: 'positive' };
}

function getEngagementList() {
  return state.prospects.map((p) => {
    const pTouches = state.touches
      .filter((t) => t.prospect_id === p.id)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    return {
      ...p,
      prospect_id: p.id,
      total_touches: pTouches.length,
      email_count: pTouches.filter((t) => t.channel === 'email').length,
      call_and_vm_count: pTouches.filter((t) => t.channel === 'phone_call' || t.channel === 'voicemail').length,
      inbound_replies: pTouches.filter((t) => t.direction === 'inbound').length,
      latest_outcome: pTouches[0]?.outcome || null,
      best_email: p.owner_email || '',
      best_phone: p.owner_phone || p.google_phone || '',
    };
  });
}

function buildDailyQueue() {
  const engaged = getEngagementList();
  const endOfTodayIso = '2026-11-24T04:59:59Z'; // end of 2026-11-23 America/New_York

  const dueNudges = engaged
    .filter(
      (e) =>
        !['booked', 'won', 'archived', 'disqualified'].includes(e.outreach_status) &&
        e.next_followup_at &&
        e.next_followup_at <= endOfTodayIso
    )
    .sort((a, b) => {
      const dateCmp = String(a.next_followup_at).localeCompare(String(b.next_followup_at));
      if (dateCmp !== 0) return dateCmp;
      return b.computed_lead_score - a.computed_lead_score;
    })
    .map((e) => ({ ...e, queue_bucket: 'FOLLOWUP_DUE' as const, priority_rank: 1 }));

  const freshHighScore = engaged
    .filter(
      (e) =>
        e.total_touches === 0 &&
        ['new', 'enriched', 'ready'].includes(e.outreach_status) &&
        e.computed_lead_score >= 60
    )
    .sort((a, b) => b.computed_lead_score - a.computed_lead_score || b.gross_approval - a.gross_approval)
    .slice(0, 20)
    .map((e) => ({ ...e, queue_bucket: 'NEW_HIGH_SCORE' as const, priority_rank: 2 }));

  const slackPayload = {
    text: `SBA Morning Queue (Mon, Nov 23) — Due Follow-Ups: ${dueNudges.length} | High-Score New: ${freshHighScore.length}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'SBA Outbound Queue • Mon, Nov 23', emoji: false },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Due Follow-Up Nudges (${dueNudges.length})*\n` +
            (dueNudges.length > 0
              ? dueNudges
                  .map(
                    (r, i) =>
                      `${i + 1}. *${r.borr_name}*${r.is_acquisition ? ' [ACQ]' : ''} (${r.borr_city}, ${r.borr_state}) — Score *${r.computed_lead_score}*\n    ${[r.best_phone, r.best_email].filter(Boolean).join(' | ')}`
                  )
                  .join('\n')
              : '_No follow-up nudges due today._'),
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Uncontacted High-Score Leads — 60+ (${freshHighScore.length})*\n` +
            (freshHighScore.length > 0
              ? freshHighScore
                  .map(
                    (r, i) =>
                      `${i + 1}. *${r.borr_name}*${r.is_acquisition ? ' [ACQ]' : ''} — Score *${r.computed_lead_score}* (${r.borr_city}, ${r.borr_state} • Loan $${Math.round(r.gross_approval).toLocaleString('en-US')})\n    ${[r.best_phone, r.best_email].filter(Boolean).join(' | ')}`
                  )
                  .join('\n')
              : '_No uncontacted high-score leads (60+) in queue._'),
        },
      },
    ],
  };

  return { dueNudges, freshHighScore, combined: [...dueNudges, ...freshHighScore], slackPayload };
}

function buildWorkflowRunSummary() {
  const grouped = new Map<
    string,
    {
      workflow_name: string;
      total_runs: number;
      success_runs: number;
      error_count: number;
      avg_duration_ms: number;
      duration_sum: number;
      last_run_at: string;
      latest_error_message: string;
    }
  >();

  for (const r of state.runs) {
    const key = r.workflow_name || 'unnamed_workflow';
    const existing = grouped.get(key) || {
      workflow_name: key,
      total_runs: 0,
      success_runs: 0,
      error_count: 0,
      avg_duration_ms: 0,
      duration_sum: 0,
      last_run_at: r.created_at,
      latest_error_message: '',
    };
    existing.total_runs += 1;
    existing.duration_sum += r.duration_ms || 0;
    if (['success', 'ok', 'completed'].includes(r.status.toLowerCase())) {
      existing.success_runs += 1;
    } else {
      existing.error_count += 1;
      if (!existing.latest_error_message || r.created_at > existing.last_run_at) {
        existing.latest_error_message = r.error_message;
      }
    }
    if (r.created_at > existing.last_run_at) {
      existing.last_run_at = r.created_at;
    }
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((g) => ({
      workflow_name: g.workflow_name,
      total_runs: g.total_runs,
      success_runs: g.success_runs,
      error_count: g.error_count,
      error_rate_pct: g.total_runs > 0 ? Number(((100 * g.error_count) / g.total_runs).toFixed(2)) : 0,
      avg_duration_ms: g.total_runs > 0 ? Math.round(g.duration_sum / g.total_runs) : 0,
      last_run_at: g.last_run_at,
      latest_error_message: g.latest_error_message || 'None',
    }))
    .sort((a, b) => b.error_count - a.error_count || b.total_runs - a.total_runs);
}

// ============================================================================
// 4. EXPRESS APP & API ROUTES
// ============================================================================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/overview', (_req, res) => {
    const queue = buildDailyQueue();
    const runSummary = buildWorkflowRunSummary();
    const totalRuns = state.runs.length;
    const totalErrors = state.runs.filter((r) => ['error', 'failed', 'timeout', 'rejected'].includes(r.status)).length;

    res.json({
      storageMode: neonConnected ? 'neon_postgres' : 'in_memory_sandbox',
      stack: {
        orchestration: 'Make',
        database: 'Neon (PostgreSQL)',
        crm: 'Airtable',
        alerts: 'Slack',
        edgeIngress: 'Cloudflare Worker (X-Webhook-Secret)',
      },
      metrics: {
        qualifiedProspects: state.prospects.length,
        dueFollowUps: queue.dueNudges.length,
        highScoreReady: queue.freshHighScore.length,
        totalRunsLogged: totalRuns,
        errorRatePct: totalRuns > 0 ? Number(((100 * totalErrors) / totalRuns).toFixed(1)) : 0,
        activeCareMrr: state.careLogs.length * 650,
        changeOrderRevenue: state.careLogs.reduce((sum, l) => sum + Number(l.change_order_revenue || 0), 0),
      },
      runSummary,
    });
  });

  app.get('/api/prospects', (_req, res) => {
    res.json({
      prospects: getEngagementList().sort((a, b) => b.computed_lead_score - a.computed_lead_score),
      touches: [...state.touches].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    });
  });

  app.post('/api/prospects/process', (req, res) => {
    const csvText = cleanStr(req.body?.csvText);
    const program = (req.body?.program === '504' ? '504' : '7a') as '7a' | '504';
    if (!csvText) {
      return res.status(400).json({ error: 'csvText is required' });
    }

    let rows: Record<string, string>[] = [];
    try {
      rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });
    } catch (err) {
      return res.status(400).json({ error: `CSV parse error: ${(err as Error).message}` });
    }

    const refDate = new Date('2026-11-23T00:00:00Z');
    const targetStates = ['GA', 'FL', 'TX', 'NC', 'TN'];
    const targetNaics = ['238', '5617', '6211', '6212', '6213', '484', '8111', '5411', '5412'];
    const excludedTokens = [
      'HOLDINGS',
      'PROPERTIES',
      'REALTY',
      'REAL ESTATE',
      'INVESTMENTS',
      'MANAGEMENT GROUP',
      'ASSOCIATES LP',
      'TRUST',
    ];

    let matched = 0;
    let added = 0;
    let merged = 0;

    for (const raw of rows) {
      const borrName = cleanStr(raw.BorrName || raw.BorrowerName || raw.BORROWER_NAME || raw.borr_name);
      const borrStreet = cleanStr(raw.BorrStreet || raw.BorrowerStreet || raw.borr_street);
      const borrCity = cleanStr(raw.BorrCity || raw.BorrowerCity || raw.borr_city);
      const borrState = cleanStr(raw.BorrState || raw.BorrowerState || raw.borr_state).toUpperCase();
      const borrZip = cleanStr(raw.BorrZip || raw.BorrowerZip || raw.borr_zip).slice(0, 5);
      const approvalRaw = cleanStr(raw.ApprovalDate || raw.APPROVAL_DATE || raw.approval_date);
      const loanRaw = cleanStr(raw.GrossApproval || raw.GROSS_APPROVAL || raw.LoanAmount || raw.gross_approval);
      const naicsCode = cleanStr(raw.NaicsCode || raw.NAICS_CODE || raw.naics_code).replace(/\D/g, '');
      const naicsDesc = cleanStr(raw.NaicsDescription || raw.naics_description);
      const businessAge = cleanStr(raw.BusinessAge || raw.business_age).toUpperCase();
      const grossApproval = parseFloat(loanRaw.replace(/[^0-9.-]+/g, '')) || 0;

      if (!borrName || !approvalRaw) continue;
      const appDate = new Date(approvalRaw);
      if (Number.isNaN(appDate.getTime())) continue;

      const months =
        (refDate.getUTCFullYear() - appDate.getUTCFullYear()) * 12 +
        (refDate.getUTCMonth() - appDate.getUTCMonth()) +
        (refDate.getUTCDate() < appDate.getUTCDate() ? -1 : 0);

      if (months < 6 || months > 24) continue;
      if (grossApproval < 250_000 || grossApproval > 2_500_000) continue;
      if (!targetStates.includes(borrState)) continue;
      if (!targetNaics.some((p) => naicsCode.startsWith(p))) continue;
      if (excludedTokens.some((t) => borrName.toUpperCase().includes(t))) continue;

      matched++;

      const cleanName = borrName
        .toUpperCase()
        .replace(/\b(LLC|INC|CORP|CORPORATION|LTD|CO|COMPANY|PLLC|PC|PA|LP)\b/g, '')
        .replace(/[^A-Z0-9]/g, '');
      const cleanStreet = borrStreet.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
      const dedupeId = crypto.createHash('sha256').update(`${cleanName}|${cleanStreet}|${borrZip}`).digest('hex').slice(0, 16);

      const isAcquisition = businessAge.includes('CHANGE OF OWNERSHIP') || cleanStr(raw.is_acquisition).toUpperCase() === 'TRUE';
      const existing = state.prospects.find((p) => p.dedupe_id === dedupeId);

      if (existing) {
        existing.loan_count += 1;
        existing.gross_approval += grossApproval;
        if (!existing.program.includes(program)) existing.program = '7a+504';
        if (isAcquisition) existing.is_acquisition = true;
        existing.computed_lead_score = computeLeadScore(existing);
        existing.campaign_track = assignCampaignTrack(existing);
        merged++;
      } else {
        const websiteUrl = cleanStr(raw.website_url || raw.Website || '');
        const hasBooking = cleanStr(raw.has_booking_link).toUpperCase() === 'TRUE';
        const siteStatus = websiteUrl ? 'HTTP_200' : 'NO_WEBSITE';
        const newRec: ProspectRecord = {
          id: crypto.randomUUID(),
          dedupe_id: dedupeId,
          program,
          loan_count: 1,
          borr_name: borrName,
          borr_street: borrStreet,
          borr_city: borrCity,
          borr_state: borrState,
          borr_zip: borrZip,
          approval_date: appDate.toISOString().slice(0, 10),
          gross_approval: grossApproval,
          naics_code: naicsCode,
          naics_description: naicsDesc || 'Target Owner-Operator Vertical',
          is_acquisition: isAcquisition,
          google_rating: 4.7,
          google_review_count: Number(raw.google_review_count || 68),
          google_phone: cleanStr(raw.google_phone || '+14045550192'),
          website_url: websiteUrl,
          normalized_domain: extractDomain(websiteUrl),
          site_status: siteStatus,
          response_time_ms: websiteUrl ? 2650 : null,
          has_booking_link: hasBooking,
          has_form_or_intake: Boolean(websiteUrl),
          mailto_only_risk: false,
          missing_viewport_meta: Boolean(websiteUrl),
          friction_tags: websiteUrl
            ? hasBooking
              ? 'BASELINE_OK'
              : 'MISSING_INSTANT_BOOKING | SLOW_SERVER_RESPONSE'
            : 'NO_WEBSITE_OPPORTUNITY',
          owner_name: cleanStr(raw.owner_name || ''),
          owner_email: cleanStr(raw.owner_email || ''),
          owner_phone: cleanStr(raw.owner_phone || ''),
          computed_lead_score: 0,
          campaign_track: '',
          outreach_status: 'ready',
          last_contacted_at: null,
          next_followup_at: null,
          airtable_record_id: `rec${dedupeId.slice(0, 8)}`,
        };
        newRec.computed_lead_score = computeLeadScore(newRec);
        newRec.campaign_track = assignCampaignTrack(newRec);
        state.prospects.unshift(newRec);
        added++;
      }
    }

    res.json({
      scanned: rows.length,
      matched,
      added,
      merged,
      totalProspects: state.prospects.length,
    });
  });

  app.get('/api/queue', (_req, res) => {
    res.json(buildDailyQueue());
  });

  app.post('/api/webhook/inbound', (req, res) => {
    const expectedSecret = process.env.SBA_WEBHOOK_SECRET || 'demo-make-shared-secret';
    const providedSecret = cleanStr(req.header('x-webhook-secret') || '');

    if (req.body?.enforceSecret !== false && providedSecret !== expectedSecret) {
      state.runs.unshift({
        id: crypto.randomUUID(),
        execution_id: `mk_exec_${Date.now()}`,
        client_slug: 'coco_club_live',
        workflow_id: 'scn_inbound_9002',
        workflow_name: 'wf1_inbound_reply_logger',
        failed_node: 'Verify X-Webhook-Secret Gate',
        status: 'rejected',
        duration_ms: 14,
        records_processed: 0,
        error_message: '401 unauthorized — missing or invalid X-Webhook-Secret',
        execution_url: 'https://us1.make.com/1042/scenarios/9002',
        created_at: new Date().toISOString(),
      });
      return res.status(401).json({ error: 'unauthorized', gate: 'X-Webhook-Secret mismatch' });
    }

    const raw = (req.body?.data && typeof req.body.data === 'object' ? { ...req.body, ...req.body.data } : req.body) as Record<
      string,
      unknown
    >;

    const fromEmail = extractEmail(raw);
    const fromPhone = extractPhone(raw);
    const explicitChannel = cleanStr(raw.channel || raw.type || '').toLowerCase();
    const sourceChannel =
      explicitChannel.includes('sms') || explicitChannel.includes('text') || (!fromEmail && fromPhone)
        ? 'sms'
        : 'email';

    const bodyText = cleanStr(raw.text || raw.body_text || raw.Body || raw.message || '');
    const replyExcerpt = bodyText.slice(0, 500);
    const subjectLine = cleanStr(
      raw.subject || raw.subject_line || (sourceChannel === 'sms' ? 'Inbound SMS Reply' : 'Inbound Email Reply')
    );

    const { outcome, sentiment } = classifyInboundReply(bodyText);
    const last10 = fromPhone.replace(/\D/g, '').slice(-10);

    const matchedProspect = state.prospects.find((p) => {
      if (fromEmail && p.owner_email.toLowerCase() === fromEmail) return true;
      if (last10.length >= 10) {
        const owner10 = p.owner_phone.replace(/\D/g, '').slice(-10);
        const google10 = p.google_phone.replace(/\D/g, '').slice(-10);
        return owner10 === last10 || google10 === last10;
      }
      return false;
    });

    const eventId =
      cleanStr(raw.event_id || raw.message_id || raw.MessageSid) ||
      `inbound_${sourceChannel}_${last10 || fromEmail || 'unknown'}_${replyExcerpt.length}`;

    let duplicateSkipped = false;
    let touchInserted: OutreachTouch | null = null;

    if (matchedProspect) {
      const existingTouch = state.touches.find((t) => t.external_event_id === eventId);
      if (existingTouch) {
        duplicateSkipped = true;
      } else {
        touchInserted = {
          id: crypto.randomUUID(),
          prospect_id: matchedProspect.id,
          external_event_id: eventId,
          channel: 'inbound_reply',
          direction: 'inbound',
          sequence_name: 'INBOUND_WEBHOOK',
          subject_line: subjectLine,
          message_summary: `Inbound ${sourceChannel.toUpperCase()} reply from ${fromEmail || fromPhone || 'unknown sender'}`,
          outcome,
          reply_sentiment: sentiment,
          reply_excerpt: replyExcerpt,
          occurred_at: new Date().toISOString(),
        };
        state.touches.unshift(touchInserted);
        matchedProspect.outreach_status = outcome === 'replied_not_fit' ? 'disqualified' : 'replied';
        matchedProspect.last_contacted_at = touchInserted.occurred_at;
        if (outcome === 'replied_not_fit') matchedProspect.next_followup_at = null;
      }
    }

    const runId = `mk_exec_${Date.now()}`;
    state.runs.unshift({
      id: crypto.randomUUID(),
      execution_id: runId,
      client_slug: 'coco_club_live',
      workflow_id: 'scn_inbound_9002',
      workflow_name: 'wf1_inbound_reply_logger',
      failed_node: '',
      status: 'success',
      duration_ms: 195,
      records_processed: matchedProspect ? 1 : 0,
      error_message: '',
      execution_url: `https://us1.make.com/1042/scenarios/9002/logs/${runId}`,
      created_at: new Date().toISOString(),
    });

    const slackAlert = matchedProspect
      ? {
          channel: '#sba-outreach',
          text: `Inbound ${sourceChannel.toUpperCase()} Reply — *${matchedProspect.borr_name}* (${outcome})\n> ${replyExcerpt}`,
        }
      : {
          channel: '#sba-outreach',
          text: `Unmatched Inbound ${sourceChannel.toUpperCase()} Reply — From: ${fromEmail || fromPhone || 'unknown'}\n> ${replyExcerpt}`,
        };

    const airtableUpdate = matchedProspect
      ? {
          table: 'SBA Prospects',
          recordId: matchedProspect.airtable_record_id,
          fields: {
            'Outreach Status': matchedProspect.outreach_status,
            'Latest Outcome': outcome,
            'Last Reply Excerpt': replyExcerpt,
          },
        }
      : null;

    res.status(200).json({
      status: 'accepted',
      normalizedPayload: {
        channel: sourceChannel,
        from_email: fromEmail,
        from_phone: fromPhone,
        subject: subjectLine,
        text: bodyText,
        event_id: eventId,
      },
      classification: { outcome, sentiment },
      matchedProspect: matchedProspect
        ? { id: matchedProspect.id, borr_name: matchedProspect.borr_name, outreach_status: matchedProspect.outreach_status }
        : null,
      duplicateSkipped,
      touchInserted,
      airtableUpdate,
      slackAlert,
    });
  });

  app.get('/api/runs', (_req, res) => {
    res.json({
      runs: state.runs,
      summary: buildWorkflowRunSummary(),
    });
  });

  app.post('/api/runs/simulate', (req, res) => {
    const mode = req.body?.mode === 'success' ? 'success' : 'error';
    const clientSlug = cleanStr(req.body?.client_slug) || 'apex_hvac';
    const workflowName = cleanStr(req.body?.workflow_name) || 'wf2_booking_reminders';
    const failedNode = cleanStr(req.body?.failed_node) || 'HTTP — Calendar Webhook';
    const errorMsg =
      mode === 'success'
        ? ''
        : cleanStr(req.body?.error_message) || 'Request timeout after 8000ms calling booking endpoint';

    const normalized =
      mode === 'success'
        ? {
            execution_id: `mk_exec_${Date.now()}`,
            client_slug: clientSlug,
            workflow_id: 'scn_make_sim',
            workflow_name: workflowName,
            failed_node: '',
            status: 'success' as const,
            error_message: '',
            execution_url: `https://us1.make.com/1042/scenarios/sim/logs/${Date.now()}`,
            created_at: new Date().toISOString(),
          }
        : normalizeMakeErrorPayload({
            scenario: { id: 'scn_make_sim', name: `${clientSlug} | ${workflowName}` },
            execution: {
              id: `mk_exec_${Date.now()}`,
              url: `https://us1.make.com/1042/scenarios/sim/logs/${Date.now()}`,
            },
            module: { name: failedNode },
            error: { message: errorMsg },
          });

    const newRun: AutomationRun = {
      id: crypto.randomUUID(),
      execution_id: normalized.execution_id,
      client_slug: normalized.client_slug,
      workflow_id: normalized.workflow_id || 'scn_make_sim',
      workflow_name: normalized.workflow_name,
      failed_node: normalized.failed_node || '',
      status: normalized.status as AutomationRun['status'],
      duration_ms: normalized.status === 'timeout' ? 8012 : 410,
      records_processed: mode === 'success' ? 3 : 0,
      error_message: normalized.error_message,
      execution_url: normalized.execution_url || 'https://us1.make.com',
      created_at: normalized.created_at,
    };

    state.runs.unshift(newRun);

    const slackPayload =
      mode === 'success'
        ? null
        : {
            text: `[${newRun.client_slug}] ${newRun.workflow_name} failed at ${newRun.failed_node}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Make Failure Alert* — \`${newRun.client_slug}\`\n*Scenario:* \`${newRun.workflow_name}\` | *Module:* \`${newRun.failed_node}\`\n*Error:* ${newRun.error_message}`,
                },
                accessory: {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Open Run' },
                  url: newRun.execution_url,
                },
              },
            ],
          };

    res.json({ run: newRun, slackPayload, summary: buildWorkflowRunSummary() });
  });

  app.get('/api/care-logs', (_req, res) => {
    res.json({ logs: state.careLogs });
  });

  app.post('/api/care-logs', (req, res) => {
    const clientSlug = cleanStr(req.body?.client_slug) || 'apex_hvac';
    const careMonth = cleanStr(req.body?.care_month) || '2026-11-01';
    const wf1 = Math.max(0, Number(req.body?.wf1_lead_runs ?? 0));
    const wf2 = Math.max(0, Number(req.body?.wf2_booking_runs ?? 0));
    const wf3 = Math.max(0, Number(req.body?.wf3_followup_runs ?? 0));

    const existingIdx = state.careLogs.findIndex(
      (l) => l.client_slug === clientSlug && l.care_month === careMonth
    );

    const record: MonthlyCareLog = {
      id: existingIdx >= 0 ? state.careLogs[existingIdx].id : crypto.randomUUID(),
      client_slug: clientSlug,
      care_month: careMonth,
      site_uptime_pct: Number(req.body?.site_uptime_pct ?? 99.95),
      downtime_incidents_count: Math.max(0, Number(req.body?.downtime_incidents_count ?? 0)),
      downtime_notes: cleanStr(req.body?.downtime_notes) || 'None',
      wf1_lead_runs: wf1,
      wf2_booking_runs: wf2,
      wf3_followup_runs: wf3,
      total_workflow_runs: wf1 + wf2 + wf3,
      failed_runs_count: Math.max(0, Number(req.body?.failed_runs_count ?? 0)),
      dropped_or_retried_count: Math.max(0, Number(req.body?.dropped_or_retried_count ?? 0)),
      top_error_summary: cleanStr(req.body?.top_error_summary) || 'None',
      care_tweaks_count: Math.max(0, Number(req.body?.care_tweaks_count ?? 0)),
      care_tweaks_summary: cleanStr(req.body?.care_tweaks_summary) || 'Routine health check & monitoring',
      change_orders_count: Math.max(0, Number(req.body?.change_orders_count ?? 0)),
      change_order_revenue: Math.max(0, Number(req.body?.change_order_revenue ?? 0)),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) state.careLogs[existingIdx] = record;
    else state.careLogs.unshift(record);

    res.json({ log: record, logs: state.careLogs });
  });

  app.post('/api/care-logs/rollup', (_req, res) => {
    const careMonth = '2026-11-01';
    const byClient = new Map<string, AutomationRun[]>();
    for (const r of state.runs) {
      const slug = r.client_slug || 'default_client';
      const arr = byClient.get(slug) || [];
      arr.push(r);
      byClient.set(slug, arr);
    }

    for (const [slug, runs] of byClient.entries()) {
      const wf1 = runs.filter((r) => /wf1|workflow_1|speed_to_lead|lead/i.test(r.workflow_name)).length;
      const wf2 = runs.filter((r) => /wf2|workflow_2|book|remind|appointment/i.test(r.workflow_name)).length;
      const wf3 = runs.filter((r) => /wf3|workflow_3|follow|review/i.test(r.workflow_name)).length;
      const failed = runs.filter((r) => ['error', 'failed', 'timeout', 'rejected'].includes(r.status)).length;
      const retried = runs.filter(
        (r) => ['timeout', 'rejected'].includes(r.status) || /retry|drop/i.test(r.error_message)
      ).length;
      const errCounts = new Map<string, number>();
      for (const r of runs) {
        if (['error', 'failed', 'timeout', 'rejected'].includes(r.status)) {
          const msg = r.error_message || 'Unspecified error';
          errCounts.set(msg, (errCounts.get(msg) || 0) + 1);
        }
      }
      const topError =
        Array.from(errCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      const idx = state.careLogs.findIndex((l) => l.client_slug === slug && l.care_month === careMonth);
      if (idx >= 0) {
        state.careLogs[idx] = {
          ...state.careLogs[idx],
          wf1_lead_runs: wf1,
          wf2_booking_runs: wf2,
          wf3_followup_runs: wf3,
          total_workflow_runs: wf1 + wf2 + wf3,
          failed_runs_count: failed,
          dropped_or_retried_count: retried,
          top_error_summary: topError,
          updated_at: new Date().toISOString(),
        };
      } else {
        state.careLogs.push({
          id: crypto.randomUUID(),
          client_slug: slug,
          care_month: careMonth,
          site_uptime_pct: 99.98,
          downtime_incidents_count: 0,
          downtime_notes: 'None',
          wf1_lead_runs: wf1,
          wf2_booking_runs: wf2,
          wf3_followup_runs: wf3,
          total_workflow_runs: wf1 + wf2 + wf3,
          failed_runs_count: failed,
          dropped_or_retried_count: retried,
          top_error_summary: topError,
          care_tweaks_count: 0,
          care_tweaks_summary: 'Routine health check & monitoring',
          change_orders_count: 0,
          change_order_revenue: 0,
          updated_at: new Date().toISOString(),
        });
      }
    }

    res.json({ logs: state.careLogs });
  });

  app.post('/api/triage', (req, res) => {
    const inAgreedSpec = Boolean(req.body?.inAgreedSpec);
    const isBrokenBehavior = Boolean(req.body?.isBrokenBehavior);
    const notExternalOrClientEdit = Boolean(req.body?.notExternalOrClientEdit);
    const minorCareTweak = Boolean(req.body?.minorCareTweak);
    const netNewFeature = Boolean(req.body?.netNewFeature);
    const changedLogic = Boolean(req.body?.changedLogic);
    const postApprovalRedesign = Boolean(req.body?.postApprovalRedesign);
    const clientName = cleanStr(req.body?.clientName) || 'Jordan';
    const companyName = cleanStr(req.body?.companyName) || 'Apex HVAC';
    const requestTitle = cleanStr(req.body?.requestTitle) || 'Additional lead routing branch';
    const quotePrice = Number(req.body?.quotePrice || 750);
    const turnaround = cleanStr(req.body?.turnaround) || '3 business days';

    let classification: 'Bug Fix' | 'Routine Care' | 'Billable Change Order' = 'Billable Change Order';
    let billingTreatment = 'Scoped & billed separately before build';
    let emailReply = '';
    let slackReply = '';

    if (inAgreedSpec && isBrokenBehavior && notExternalOrClientEdit && !netNewFeature && !changedLogic) {
      classification = 'Bug Fix';
      billingTreatment = 'Included (no charge)';
      emailReply = `Hi ${clientName},\n\nGood catch — that behavior is part of the agreed spec for ${companyName}. I've logged it as a bug fix and am patching it now. I'll confirm here as soon as the fix is verified.\n\nBest,\nCoco`;
      slackReply = `Good catch ${clientName} — logging "${requestTitle}" as a bug fix and getting it patched right away.`;
    } else if (minorCareTweak && !netNewFeature && !changedLogic && !postApprovalRedesign) {
      classification = 'Routine Care';
      billingTreatment = 'Included under $650/mo Monthly Care';
      emailReply = `Hi ${clientName},\n\nGot it — I'll take care of "${requestTitle}" under your $650/mo care plan and notify you once it's live.\n\nBest,\nCoco`;
      slackReply = `On it — handling "${requestTitle}" under your $650/mo care plan. Will ping when live.`;
    } else {
      classification = 'Billable Change Order';
      billingTreatment = `Separate Change Order ($${quotePrice.toLocaleString('en-US')} fixed)`;
      emailReply = `Hi ${clientName},\n\n"${requestTitle}" is outside the original Tier 2 scope, so I'm keeping it cleanly separate as a fixed-price add-on before we touch any live workflows:\n\n• Deliverable: ${requestTitle}\n• Price: $${quotePrice.toLocaleString('en-US')} fixed\n• Turnaround: ${turnaround} from approval & deposit\n\nReply "Approved" and I'll send the invoice link to lock in your build slot.\n\nBest,\nCoco`;
      slackReply = `That's outside the original scope — happy to handle "${requestTitle}" as a fixed $${quotePrice.toLocaleString('en-US')} change order (${turnaround}). Reply "Approved" and I'll send the invoice to kick off.`;
    }

    res.json({
      classification,
      billingTreatment,
      emailReply,
      slackReply,
    });
  });

  app.get('/api/blueprints', (_req, res) => {
    const readSafe = (rel: string) => {
      try {
        return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      } catch {
        return '';
      }
    };

    res.json({
      sql: {
        masterSchema: readSafe('sba_prospects.sql'),
        careMetricsSchema: readSafe('sba-care-metrics-schema.sql'),
        careRollupUpsert: readSafe('sba-monthly-care-upsert.sql'),
        dailyQueueQueries: readSafe('sba-daily-queue-queries.sql'),
        runErrorQueries: readSafe('sba-run-error-queries.sql'),
      },
      make: {
        morningQueue: readSafe('sba-make-morning-queue-scenario.json'),
        inboundReply: readSafe('sba-make-inbound-reply-scenario.json'),
        errorWatcher: readSafe('sba-make-error-watcher-scenario.json'),
        errorNormalizer: readSafe('sba-make-error-normalize.js'),
      },
      worker: {
        normalizedWorker: readSafe('sba-webhook-relay-worker-normalized.js'),
        wranglerToml: readSafe('sba-webhook-relay-wrangler.toml'),
      },
    });
  });

  // ============================================================================
  // 5. VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[SERVER] SBA Pipeline Ops Console running at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
