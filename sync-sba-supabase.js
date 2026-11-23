import fs from 'node:fs';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
const CONFIG = {
  inputCsv: './output/enriched_sba_prospects.csv',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  batchSize: 100,
  topLeadsLimit: 15,
};

if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ============================================================================
// 2. SAFE TYPE COERCION & PAYLOAD MAPPING
// ============================================================================

function toBool(val, fallback = false) {
  if (typeof val === 'boolean') return val;
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  const normalized = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function toInt(val, fallback = null) {
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  const parsed = Number.parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(val, fallback = null) {
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  const parsed = Number.parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCleanStr(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val).trim();
}

function normalizeProgram(val) {
  const raw = toCleanStr(val, '7a').toLowerCase();
  if (raw.includes('7a') && raw.includes('504')) return '7a+504';
  if (raw.includes('504')) return '504';
  return '7a';
}

function mapCsvRowToDbRecord(row) {
  const dedupeId = toCleanStr(row.dedupe_id);
  const borrName = toCleanStr(row.borr_name);

  if (!dedupeId || !borrName) {
    return null;
  }

  const approvalDateRaw = toCleanStr(row.approval_date);
  const approvalDate = /^\d{4}-\d{2}-\d{2}$/.test(approvalDateRaw) ? approvalDateRaw : null;

  // Omit computed_lead_score because it is a GENERATED ALWAYS AS ... STORED column in Postgres
  return {
    dedupe_id: dedupeId,
    google_place_id: toCleanStr(row.google_place_id) || null,
    program: normalizeProgram(row.program),
    loan_count: Math.max(1, toInt(row.loan_count, 1)),
    borr_name: borrName,
    borr_street: toCleanStr(row.borr_street),
    borr_city: toCleanStr(row.borr_city),
    borr_state: toCleanStr(row.borr_state).toUpperCase().slice(0, 2),
    borr_zip: toCleanStr(row.borr_zip).slice(0, 10),
    approval_date: approvalDate,
    gross_approval: Math.max(0, toFloat(row.gross_approval, 0)),
    naics_code: toCleanStr(row.naics_code).slice(0, 10),
    naics_description: toCleanStr(row.naics_description),
    business_age: toCleanStr(row.business_age),
    business_type: toCleanStr(row.business_type),
    is_acquisition: toBool(row.is_acquisition, false),
    jobs_supported: Math.max(0, toInt(row.jobs_supported, 0)),
    lender_name: toCleanStr(row.lender_name),

    place_found: toBool(row.place_found, false),
    google_name: toCleanStr(row.google_name),
    google_address: toCleanStr(row.google_address),
    website_url: toCleanStr(row.website_url),
    google_rating: toFloat(row.google_rating, null),
    google_review_count: Math.max(0, toInt(row.google_review_count, 0)),
    google_phone: toCleanStr(row.google_phone),
    places_error: toCleanStr(row.places_error),

    site_status: toCleanStr(row.site_status, 'PENDING') || 'PENDING',
    response_time_ms: toInt(row.response_time_ms, null),
    has_booking_link: toBool(row.has_booking_link, false),
    booking_provider_detected: toCleanStr(row.booking_provider_detected),
    has_form_or_intake: toBool(row.has_form_or_intake, false),
    form_count: Math.max(0, toInt(row.form_count, 0)),
    mailto_only_risk: toBool(row.mailto_only_risk, false),
    missing_viewport_meta: toBool(row.missing_viewport_meta, false),
    friction_tags: toCleanStr(row.friction_tags),
    site_audit_notes: toCleanStr(row.site_audit_notes),

    outreach_status: 'enriched',
    enriched_at: new Date().toISOString(),
  };
}

// ============================================================================
// 3. CSV READER & BATCH UPSERTER
// ============================================================================

async function readRecordsFromCsv(filePath) {
  const records = [];
  let skipped = 0;

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  for await (const rawRow of parser) {
    const mapped = mapCsvRowToDbRecord(rawRow);
    if (mapped) {
      records.push(mapped);
    } else {
      skipped++;
    }
  }

  return { records, skipped };
}

async function upsertInBatches(records, batchSize) {
  let upsertedCount = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);

    const { data, error } = await supabase
      .from('sba_prospects')
      .upsert(chunk, {
        onConflict: 'dedupe_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      throw new Error(`Batch ${batchNumber}/${totalBatches} failed: ${error.message}`);
    }

    upsertedCount += data ? data.length : chunk.length;
    console.log(`[UPSERT] Batch ${batchNumber}/${totalBatches} complete (${upsertedCount}/${records.length})`);
  }

  return upsertedCount;
}

// ============================================================================
// 4. TOP-SCORED LEADS REPORTER
// ============================================================================

async function printTopScoredLeads(limit) {
  const { data, error } = await supabase
    .from('sba_prospects')
    .select(
      [
        'computed_lead_score',
        'campaign_track',
        'borr_name',
        'borr_city',
        'borr_state',
        'is_acquisition',
        'gross_approval',
        'google_review_count',
        'has_booking_link',
        'site_status',
        'response_time_ms',
        'website_url',
        'friction_tags',
      ].join(', ')
    )
    .order('computed_lead_score', { ascending: false })
    .order('is_acquisition', { ascending: false })
    .order('gross_approval', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed querying top leads: ${error.message}`);
  }

  console.log('\n====================================================================');
  console.log(`TOP ${data.length} SCORED SBA PROSPECTS`);
  console.log('====================================================================');

  data.forEach((lead, index) => {
    const loanFmt = Number(lead.gross_approval || 0).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
    const speedLabel = lead.response_time_ms ? `${lead.response_time_ms}ms` : lead.site_status;
    const acqFlag = lead.is_acquisition ? ' [ACQ]' : '';

    console.log(
      `${String(index + 1).padStart(2, ' ')}. [Score: ${lead.computed_lead_score}] ${lead.borr_name}${acqFlag} (${lead.borr_city}, ${lead.borr_state})`
    );
    console.log(
      `    Track: ${lead.campaign_track} | Loan: ${loanFmt} | Reviews: ${lead.google_review_count} | Booking: ${lead.has_booking_link ? 'Yes' : 'No'} | Speed: ${speedLabel}`
    );
    console.log(
      `    URL: ${lead.website_url || 'N/A'} | Friction: ${lead.friction_tags || 'NONE'}`
    );
  });
}

// ============================================================================
// 5. EXECUTION ENTRYPOINT
// ============================================================================

async function run() {
  if (!fs.existsSync(CONFIG.inputCsv)) {
    console.error(`Input CSV not found: ${CONFIG.inputCsv}`);
    process.exit(1);
  }

  const { records, skipped } = await readRecordsFromCsv(CONFIG.inputCsv);
  console.log(`[LOAD] Prepared ${records.length} valid records (skipped ${skipped} malformed rows)`);

  if (records.length === 0) {
    console.log('No records to upsert.');
    return;
  }

  const totalUpserted = await upsertInBatches(records, CONFIG.batchSize);
  console.log(`[DONE] Total records upserted into public.sba_prospects: ${totalUpserted}`);

  await printTopScoredLeads(CONFIG.topLeadsLimit);
}

run().catch((err) => {
  console.error('Sync script failed:', err.message);
  process.exit(1);
});
