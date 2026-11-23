import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

// ============================================================================
// 1. CONFIGURATION & DETERMINISTIC RULES
// ============================================================================
const CONFIG = {
  inputFiles: [
    { path: './data/sba_7a.csv', program: '7a' },
    { path: './data/sba_504.csv', program: '504' },
  ],
  outputFile: './output/qualified_sba_operators.csv',

  // Reference date for deterministic window calculations (YYYY-MM-DD)
  referenceDate: new Date('2026-11-23T00:00:00Z'),
  minMonthsSinceApproval: 6,
  maxMonthsSinceApproval: 24,

  // Loan size sweet spot (filters out micro-loans & enterprise chains)
  minLoanAmount: 250_000,
  maxLoanAmount: 2_500_000,

  // Optional geographic filter (leave empty array [] for all US states)
  targetStates: ['GA', 'FL', 'TX', 'NC', 'TN'],

  // Target high-admin, quote/scheduling-heavy NAICS prefixes (2, 3, 4, or 6 digits)
  targetNaicsPrefixes: [
    '238',    // Specialty Trade Contractors (HVAC, Plumbing, Electrical)
    '5617',   // Services to Buildings & Dwellings (Commercial Cleaning, Landscaping)
    '6211',   // Offices of Physicians
    '6212',   // Offices of Dentists
    '6213',   // Offices of Other Health Practitioners (PT, Chiro, Optometry)
    '484',    // Truck Transportation & Local Freight
    '8111',   // Automotive Repair & Maintenance
    '5411',   // Legal Services
    '5412',   // Accounting, Tax Preparation, Bookkeeping
  ],

  // Exclude passive real estate shells & holding companies
  excludedNameTokens: [
    'HOLDINGS',
    'PROPERTIES',
    'REALTY',
    'REAL ESTATE',
    'INVESTMENTS',
    'MANAGEMENT GROUP',
    'ASSOCIATES LP',
    'TRUST',
  ],

  // Keep only established businesses or Change-of-Ownership acquisitions
  allowedBusinessTypes: [
    'EXISTING OR MORE THAN 2 YEARS OLD',
    'CHANGE OF OWNERSHIP',
    'NEW BUSINESS OR 2 YEARS OR LESS', // Optional: remove if you strictly want acquisitions/existing
  ],
};

// ============================================================================
// 2. NORMALIZATION & HELPER FUNCTIONS
// ============================================================================

/**
 * Safely picks the first matching column across varying SBA 7(a) vs 504 headers
 */
function pickField(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

/**
 * Parses currency strings like "$450,000.00" or "450000" into a clean float
 */
function parseAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.-]+/g, '');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

/**
 * Parses MM/DD/YYYY or YYYY-MM-DD into a UTC Date object
 */
function parseSbaDate(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();

  // Handle MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  // Handle YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  return null;
}

/**
 * Calculates whole months elapsed between approval date and reference date
 */
function monthsBetween(startDate, endDate) {
  const years = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  const months = endDate.getUTCMonth() - startDate.getUTCMonth();
  const dayAdjustment = endDate.getUTCDate() < startDate.getUTCDate() ? -1 : 0;
  return years * 12 + months + dayAdjustment;
}

/**
 * Normalizes a raw SBA row into a unified schema
 */
function normalizeRow(rawRow, program) {
  const name = pickField(rawRow, ['BorrName', 'BorrowerName', 'BORROWER_NAME']);
  const street = pickField(rawRow, ['BorrStreet', 'BorrowerStreet', 'BORROWER_STREET']);
  const city = pickField(rawRow, ['BorrCity', 'BorrowerCity', 'BORROWER_CITY']);
  const state = pickField(rawRow, ['BorrState', 'BorrowerState', 'BORROWER_STATE']).toUpperCase();
  const zip = pickField(rawRow, ['BorrZip', 'BorrowerZip', 'BORROWER_ZIP']).slice(0, 5);

  const approvalDateRaw = pickField(rawRow, ['ApprovalDate', 'APPROVAL_DATE']);
  const approvalDate = parseSbaDate(approvalDateRaw);

  const grossApproval = parseAmount(
    pickField(rawRow, ['GrossApproval', 'GROSS_APPROVAL', 'LoanAmount'])
  );

  const naicsCode = pickField(rawRow, ['NaicsCode', 'NAICS_CODE', 'NAICS']).replace(/\D/g, '');
  const naicsDesc = pickField(rawRow, ['NaicsDescription', 'NAICS_DESCRIPTION']);
  const businessAge = pickField(rawRow, ['BusinessAge', 'BUSINESS_AGE']).toUpperCase();
  const businessType = pickField(rawRow, ['BusinessType', 'BUSINESS_TYPE']).toUpperCase();
  const bankName = pickField(rawRow, ['BankName', 'LenderName', 'CDC_Name', 'BANK_NAME']);
  const jobsSupported = parseInt(pickField(rawRow, ['JobsSupported', 'JOBS_SUPPORTED']) || '0', 10);

  // Flag high-priority acquisition deals
  const isAcquisition =
    businessAge.includes('CHANGE OF OWNERSHIP') ||
    businessType.includes('CHANGE OF OWNERSHIP');

  return {
    program,
    borr_name: name,
    borr_street: street,
    borr_city: city,
    borr_state: state,
    borr_zip: zip,
    approval_date: approvalDate ? approvalDate.toISOString().slice(0, 10) : '',
    _approvalDateObj: approvalDate,
    gross_approval: grossApproval,
    naics_code: naicsCode,
    naics_description: naicsDesc,
    business_age: businessAge,
    business_type: businessType,
    is_acquisition: isAcquisition ? 'TRUE' : 'FALSE',
    jobs_supported: Number.isFinite(jobsSupported) ? jobsSupported : 0,
    lender_name: bankName,
  };
}

/**
 * Generates a deterministic deduplication key from normalized entity + location
 */
function buildDedupeKey(record) {
  const cleanName = record.borr_name
    .toUpperCase()
    .replace(/\b(LLC|INC|CORP|CORPORATION|LTD|CO|COMPANY|PLLC|PC|PA|LP)\b/g, '')
    .replace(/[^A-Z0-9]/g, '');

  const cleanStreet = record.borr_street
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);

  const rawKey = `${cleanName}|${cleanStreet}|${record.borr_zip}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
}

// ============================================================================
// 3. FILTERING ENGINE
// ============================================================================

function passesFilters(record) {
  // 1. Must have a valid name and approval date
  if (!record.borr_name || !record._approvalDateObj) return false;

  // 2. Date Window Filter (6 to 24 months post-approval)
  const elapsedMonths = monthsBetween(record._approvalDateObj, CONFIG.referenceDate);
  if (
    elapsedMonths < CONFIG.minMonthsSinceApproval ||
    elapsedMonths > CONFIG.maxMonthsSinceApproval
  ) {
    return false;
  }

  // 3. Loan Amount Filter
  if (
    record.gross_approval < CONFIG.minLoanAmount ||
    record.gross_approval > CONFIG.maxLoanAmount
  ) {
    return false;
  }

  // 4. Geographic Filter (if configured)
  if (
    CONFIG.targetStates.length > 0 &&
    !CONFIG.targetStates.includes(record.borr_state)
  ) {
    return false;
  }

  // 5. NAICS Prefix Filter
  if (CONFIG.targetNaicsPrefixes.length > 0) {
    const matchesNaics = CONFIG.targetNaicsPrefixes.some((prefix) =>
      record.naics_code.startsWith(prefix)
    );
    if (!matchesNaics) return false;
  }

  // 6. Exclude Passive Real Estate / Holding Entities
  const upperName = record.borr_name.toUpperCase();
  const hasExcludedToken = CONFIG.excludedNameTokens.some((token) =>
    upperName.includes(token)
  );
  if (hasExcludedToken) return false;

  // 7. Ownership / Business Age Filter (if field is populated in CSV)
  if (record.business_age && CONFIG.allowedBusinessTypes.length > 0) {
    const matchesAge = CONFIG.allowedBusinessTypes.some((allowed) =>
      record.business_age.includes(allowed)
    );
    if (!matchesAge) return false;
  }

  return true;
}

// ============================================================================
// 4. STREAMING PIPELINE EXECUTION
// ============================================================================

async function run() {
  const dedupeMap = new Map();
  let totalRead = 0;
  let totalMatched = 0;

  for (const source of CONFIG.inputFiles) {
    if (!fs.existsSync(source.path)) {
      console.warn(`[SKIP] File not found: ${source.path}`);
      continue;
    }

    console.log(`[READ] Streaming ${source.path} (${source.program})...`);

    const parser = fs.createReadStream(source.path).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      })
    );

    for await (const rawRow of parser) {
      totalRead++;
      const normalized = normalizeRow(rawRow, source.program);

      if (!passesFilters(normalized)) continue;
      totalMatched++;

      const dedupeKey = buildDedupeKey(normalized);
      const existing = dedupeMap.get(dedupeKey);

      if (!existing) {
        dedupeMap.set(dedupeKey, {
          dedupe_id: dedupeKey,
          ...normalized,
          loan_count: 1,
        });
      } else {
        // Merge duplicate loans for the same borrower (e.g., combo 7a + 504 or twin tranches)
        existing.loan_count += 1;
        existing.gross_approval += normalized.gross_approval;
        if (!existing.program.includes(normalized.program)) {
          existing.program = `${existing.program}+${normalized.program}`;
        }
        if (normalized.is_acquisition === 'TRUE') {
          existing.is_acquisition = 'TRUE';
        }
        // Keep the most recent approval date
        if (normalized.approval_date > existing.approval_date) {
          existing.approval_date = normalized.approval_date;
        }
      }
    }
  }

  // Sort output: Acquisitions first, then highest total loan approval descending
  const results = Array.from(dedupeMap.values())
    .map(({ _approvalDateObj, ...cleanRecord }) => cleanRecord)
    .sort((a, b) => {
      if (a.is_acquisition !== b.is_acquisition) {
        return a.is_acquisition === 'TRUE' ? -1 : 1;
      }
      return b.gross_approval - a.gross_approval;
    });

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });

  // Write clean CSV
  await new Promise((resolve, reject) => {
    const stringifier = stringify({ header: true });
    const writable = fs.createWriteStream(CONFIG.outputFile);
    stringifier.pipe(writable);

    for (const row of results) {
      stringifier.write(row);
    }
    stringifier.end();
    writable.on('finish', resolve);
    writable.on('error', reject);
  });

  console.log('--------------------------------------------------');
  console.log(`Total Raw Rows Scanned : ${totalRead.toLocaleString()}`);
  console.log(`Rows Passing Filters   : ${totalMatched.toLocaleString()}`);
  console.log(`Unique Operators Saved : ${results.length.toLocaleString()}`);
  console.log(`Output Written To      : ${CONFIG.outputFile}`);
  console.log('--------------------------------------------------');
}

run().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
