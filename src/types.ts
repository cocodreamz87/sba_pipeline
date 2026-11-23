export type NavTab = 'queue' | 'webhook' | 'runs' | 'care' | 'triage';

export interface OverviewResponse {
  storageMode: 'neon_postgres' | 'in_memory_sandbox';
  stack: {
    orchestration: string;
    database: string;
    crm: string;
    alerts: string;
    edgeIngress: string;
  };
  metrics: {
    qualifiedProspects: number;
    dueFollowUps: number;
    highScoreReady: number;
    totalRunsLogged: number;
    errorRatePct: number;
    activeCareMrr: number;
    changeOrderRevenue: number;
  };
  runSummary: WorkflowRunSummary[];
}

export interface Prospect {
  id: string;
  dedupe_id: string;
  program: '7a' | '504' | '7a+504';
  loan_count: number;
  borr_name: string;
  borr_city: string;
  borr_state: string;
  approval_date: string;
  gross_approval: number;
  naics_code: string;
  naics_description: string;
  is_acquisition: boolean;
  google_rating: number | null;
  google_review_count: number;
  google_phone: string;
  website_url: string;
  site_status: string;
  response_time_ms: number | null;
  has_booking_link: boolean;
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
  total_touches: number;
  email_count: number;
  call_and_vm_count: number;
  inbound_replies: number;
  latest_outcome: string | null;
  best_email: string;
  best_phone: string;
  queue_bucket?: 'FOLLOWUP_DUE' | 'NEW_HIGH_SCORE';
}

export interface OutreachTouch {
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

export interface AutomationRun {
  id: string;
  execution_id: string;
  client_slug: string;
  workflow_id: string;
  workflow_name: string;
  failed_node: string;
  status: string;
  duration_ms: number;
  records_processed: number;
  error_message: string;
  execution_url: string;
  created_at: string;
}

export interface WorkflowRunSummary {
  workflow_name: string;
  total_runs: number;
  success_runs: number;
  error_count: number;
  error_rate_pct: number;
  avg_duration_ms: number;
  last_run_at: string;
  latest_error_message: string;
}

export interface MonthlyCareLog {
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

export interface BlueprintsBundle {
  sql: {
    masterSchema: string;
    careMetricsSchema: string;
    careRollupUpsert: string;
    dailyQueueQueries: string;
    runErrorQueries: string;
  };
  make: {
    morningQueue: string;
    inboundReply: string;
    errorWatcher: string;
    errorNormalizer: string;
  };
  worker: {
    normalizedWorker: string;
    wranglerToml: string;
  };
}
