import fs from 'node:fs';
import 'dotenv/config';
import { Pool } from 'pg';
import { parse } from 'csv-parse';

// ============================================================================
// 1. CONFIGURATION (Neon PostgreSQL + Optional Airtable CRM Sync)
// ============================================================================
const CONFIG = {
  inputCsv: './output/enriched_sba_prospects.csv',
  databaseUrl: process.env.DATABASE_URL,
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  airtableTable: process.env.AIRTABLE_PROSPECTS_TABLE || 'SBA Prospects',
  batchSize: 50,
  topLeadsLimit: 15,
};

if (!CONFIG.databaseUrl) {
  console.error('Missing DATABASE_URL (Neon PostgreSQL connection string) in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: CONFIG.databaseUrl,
  ssl: CONFIG.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
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
  if (!dedupeId || !borrName) return null;

  const approvalDateRaw = toCleanStr(row.approval_date);
  const approvalDate = /^\d{4}-\d{2}-\d{2}$/.test(approvalDateRaw) ? approvalDateRaw : null;

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
// 3. CSV READER & NEON POSTGRES BATCH UPSERTER
// ============================================================================
async function readRecordsFromCsv(filePath) {
  const records = [];
  let skipped = 0;

  const parser = fs.createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );

  for await (const rawRow of parser) {
    const mapped = mapCsvRowToDbRecord(rawRow);
    if (mapped) records.push(mapped);
    else skipped++;
  }

  return { records, skipped };
}

const UPSERT_SQL = `
insert into public.sba_prospects (
  dedupe_id, google_place_id, program, loan_count,
  borr_name, borr_street, borr_city, borr_state, borr_zip,
  approval_date, gross_approval, naics_code, naics_description,
  business_age, business_type, is_acquisition, jobs_supported, lender_name,
  place_found, google_name, google_address, website_url,
  google_rating, google_review_count, google_phone, places_error,
  site_status, response_time_ms, has_booking_link, booking_provider_detected,
  has_form_or_intake, form_count, mailto_only_risk, missing_viewport_meta,
  friction_tags, site_audit_notes, outreach_status, enriched_at
) values (
  $1, $2, $3::public.sba_program_type, $4,
  $5, $6, $7, $8, $9,
  $10::date, $11, $12, $13,
  $14, $15, $16, $17, $18,
  $19, $20, $21, $22,
  $23, $24, $25, $26,
  $27, $28, $29, $30,
  $31, $32, $33, $34,
  $35, $36, $37::public.outreach_status_type, $38::timestamptz
)
on conflict (dedupe_id) do update set
  google_place_id = coalesce(excluded.google_place_id, public.sba_prospects.google_place_id),
  program = excluded.program,
  loan_count = excluded.loan_count,
  borr_name = excluded.borr_name,
  borr_street = excluded.borr_street,
  borr_city = excluded.borr_city,
  borr_state = excluded.borr_state,
  borr_zip = excluded.borr_zip,
  approval_date = excluded.approval_date,
  gross_approval = excluded.gross_approval,
  naics_code = excluded.naics_code,
  naics_description = excluded.naics_description,
  business_age = excluded.business_age,
  business_type = excluded.business_type,
  is_acquisition = excluded.is_acquisition,
  jobs_supported = excluded.jobs_supported,
  lender_name = excluded.lender_name,
  place_found = excluded.place_found,
  google_name = excluded.google_name,
  google_address = excluded.google_address,
  website_url = excluded.website_url,
  google_rating = excluded.google_rating,
  google_review_count = excluded.google_review_count,
  google_phone = excluded.google_phone,
  places_error = excluded.places_error,
  site_status = excluded.site_status,
  response_time_ms = excluded.response_time_ms,
  has_booking_link = excluded.has_booking_link,
  booking_provider_detected = excluded.booking_provider_detected,
  has_form_or_intake = excluded.has_form_or_intake,
  form_count = excluded.form_count,
  mailto_only_risk = excluded.mailto_only_risk,
  missing_viewport_meta = excluded.missing_viewport_meta,
  friction_tags = excluded.friction_tags,
  site_audit_notes = excluded.site_audit_notes,
  enriched_at = excluded.enriched_at,
  updated_at = now()
returning id, dedupe_id, borr_name, computed_lead_score, campaign_track;
`;

async function upsertToNeon(records) {
  const client = await pool.connect();
  const upserted = [];
  try {
    await client.query('begin');
    for (const r of records) {
      const res = await client.query(UPSERT_SQL, [
        r.dedupe_id, r.google_place_id, r.program, r.loan_count,
        r.borr_name, r.borr_street, r.borr_city, r.borr_state, r.borr_zip,
        r.approval_date, r.gross_approval, r.naics_code, r.naics_description,
        r.business_age, r.business_type, r.is_acquisition, r.jobs_supported, r.lender_name,
        r.place_found, r.google_name, r.google_address, r.website_url,
        r.google_rating, r.google_review_count, r.google_phone, r.places_error,
        r.site_status, r.response_time_ms, r.has_booking_link, r.booking_provider_detected,
        r.has_form_or_intake, r.form_count, r.mailto_only_risk, r.missing_viewport_meta,
        r.friction_tags, r.site_audit_notes, r.outreach_status, r.enriched_at,
      ]);
      upserted.push(res.rows[0]);
    }
    await client.query('commit');
    return upserted;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function syncTopLeadsToAirtable(rows) {
  if (!CONFIG.airtableApiKey || !CONFIG.airtableBaseId || rows.length === 0) return 0;

  const url = `https://api.airtable.com/v0/${CONFIG.airtableBaseId}/${encodeURIComponent(CONFIG.airtableTable)}`;
  let synced = 0;

  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10).map((lead) => ({
      fields: {
        'Dedupe ID': lead.dedupe_id,
        'Company Name': lead.borr_name,
        'City': lead.borr_city,
        'State': lead.borr_state,
        'Campaign Track': lead.campaign_track,
        'Lead Score': lead.computed_lead_score,
        'Loan Amount': Number(lead.gross_approval || 0),
        'Acquisition': Boolean(lead.is_acquisition),
        'Website': lead.website_url || '',
        'Friction Tags': lead.friction_tags || '',
        'Outreach Status': lead.outreach_status,
      },
    }));

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${CONFIG.airtableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ['Dedupe ID'] },
        records: chunk,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.warn(`[AIRTABLE] Batch warning (${res.status}): ${msg.slice(0, 160)}`);
    } else {
      synced += chunk.length;
    }
  }
  return synced;
}

async function printTopScoredLeads(limit) {
  const { rows } = await pool.query(
    `select
       dedupe_id, computed_lead_score, campaign_track, borr_name,
       borr_city, borr_state, is_acquisition, gross_approval,
       google_review_count, has_booking_link, site_status,
       response_time_ms, website_url, friction_tags, outreach_status
     from public.sba_prospects
     order by computed_lead_score desc, is_acquisition desc, gross_approval desc
     limit $1`,
    [limit]
  );

  console.log('\n====================================================================');
  console.log(`TOP ${rows.length} SCORED SBA PROSPECTS (NEON POSTGRES)`);
  console.log('====================================================================');

  rows.forEach((lead, index) => {
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
  });

  return rows;
}

async function run() {
  if (!fs.existsSync(CONFIG.inputCsv)) {
    console.error(`Input CSV not found: ${CONFIG.inputCsv}`);
    process.exit(1);
  }

  const { records, skipped } = await readRecordsFromCsv(CONFIG.inputCsv);
  console.log(`[LOAD] Prepared ${records.length} valid records (skipped ${skipped} malformed rows)`);

  if (records.length === 0) return;

  const upserted = await upsertToNeon(records);
  console.log(`[DONE] Upserted ${upserted.length} records into Neon public.sba_prospects`);

  const topLeads = await printTopScoredLeads(CONFIG.topLeadsLimit);
  const airtableCount = await syncTopLeadsToAirtable(topLeads);
  if (airtableCount > 0) {
    console.log(`[AIRTABLE] Synced ${airtableCount} top leads to ${CONFIG.airtableTable}`);
  }
}

run()
  .catch((err) => {
    console.error('Neon sync failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
