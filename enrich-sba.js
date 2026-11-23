import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
const CONFIG = {
  inputCsv: './output/qualified_sba_operators.csv',
  outputCsv: './output/enriched_sba_prospects.csv',
  apiKey: process.env.GOOGLE_PLACES_API_KEY,

  // Concurrency & pacing (prevents rate-limit spikes or memory overload)
  concurrency: 4,
  delayBetweenBatchesMs: 250,

  // HTTP fetch settings for website inspection
  siteTimeoutMs: 7000,
  slowResponseThresholdMs: 2500,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',

  // Known instant-booking / scheduling / intake platforms
  bookingProviders: [
    'calendly.com',
    'cal.com',
    'acuityscheduling.com',
    'hubspot.com/meetings',
    'meetings.hubspot.com',
    'servicetitan.com',
    'housecallpro.com',
    'jobber.com',
    'zocdoc.com',
    'setmore.com',
    'square.site',
    'squareup.com/appointments',
    'vagaro.com',
    'mindbodyonline.com',
    'schedulicity.com',
    'chilipiper.com',
    'oncehub.com',
    'appointlet.com',
  ],
};

if (!CONFIG.apiKey) {
  console.error('Missing GOOGLE_PLACES_API_KEY in environment or .env file.');
  process.exit(1);
}

// ============================================================================
// 2. GOOGLE PLACES API (NEW) TEXT SEARCH
// ============================================================================

async function lookupPlaceDetails(row) {
  const queryParts = [
    row.borr_name,
    row.borr_street,
    row.borr_city,
    row.borr_state,
    row.borr_zip,
  ].filter(Boolean);

  const textQuery = queryParts.join(', ');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': CONFIG.apiKey,
        // Request only needed fields to keep API billing lean
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.nationalPhoneNumber',
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Places API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      return {
        place_found: 'FALSE',
        google_place_id: '',
        google_name: '',
        google_address: '',
        website_url: '',
        google_rating: '',
        google_review_count: 0,
        google_phone: '',
        places_error: '',
      };
    }

    return {
      place_found: 'TRUE',
      google_place_id: place.id || '',
      google_name: place.displayName?.text || '',
      google_address: place.formattedAddress || '',
      website_url: place.websiteUri || '',
      google_rating: place.rating ?? '',
      google_review_count: place.userRatingCount ?? 0,
      google_phone: place.nationalPhoneNumber || '',
      places_error: '',
    };
  } catch (err) {
    return {
      place_found: 'FALSE',
      google_place_id: '',
      google_name: '',
      google_address: '',
      website_url: '',
      google_rating: '',
      google_review_count: 0,
      google_phone: '',
      places_error: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 3. WEBSITE & BOOKING / FORM FRICTION AUDITOR
// ============================================================================

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function auditWebsite(rawUrl) {
  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return {
      site_status: 'NO_WEBSITE',
      response_time_ms: '',
      has_booking_link: 'FALSE',
      booking_provider_detected: '',
      has_form_or_intake: 'FALSE',
      form_count: 0,
      mailto_only_risk: 'FALSE',
      missing_viewport_meta: 'FALSE',
      friction_tags: 'NO_WEBSITE_OPPORTUNITY',
      lead_priority_score: 85,
      site_audit_notes: 'No website listed on Google Business Profile',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.siteTimeoutMs);
  const startTime = performance.now();

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    const elapsedMs = Math.round(performance.now() - startTime);
    const html = await res.text();
    const lowerHtml = html.toLowerCase();

    // Detect scheduling / instant-booking integrations or links
    const matchedProviders = CONFIG.bookingProviders.filter((provider) =>
      lowerHtml.includes(provider)
    );
    const hasBookingKeyword =
      /(book[\s_-]?(now|online|appointment|call|consultation)|schedule[\s_-]?(now|online|call|a[\s_-]?call)|get[\s_-]?a[\s_-]?quote|request[\s_-]?estimate)/i.test(
        lowerHtml
      );

    const hasBookingLink = matchedProviders.length > 0 || hasBookingKeyword;

    // Detect HTML forms, intake embeds, and mailto links
    const formMatches = lowerHtml.match(/<form\b/g) || [];
    const formCount = formMatches.length;
    const hasIntakeEmbed =
      /(typeform|jotform|tally\.so|gravityforms|wpforms|contact-form-7|hubspot.*form|hs-form)/i.test(
        lowerHtml
      );
    const hasFormOrIntake = formCount > 0 || hasIntakeEmbed;
    const hasMailto = /href=["']mailto:/i.test(lowerHtml);
    const mailtoOnlyRisk = !hasFormOrIntake && !hasBookingLink && hasMailto;

    // Detect mobile viewport configuration & slow initial HTML transfer
    const hasViewportMeta =
      /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
    const missingViewportMeta = !hasViewportMeta;
    const isSlowResponse = elapsedMs >= CONFIG.slowResponseThresholdMs;

    // Assemble deterministic friction tags & score
    const tags = [];
    let score = 40;

    if (!hasBookingLink) {
      tags.push('MISSING_INSTANT_BOOKING');
      score += 25;
    }
    if (isSlowResponse) {
      tags.push('SLOW_SERVER_RESPONSE');
      score += 15;
    }
    if (mailtoOnlyRisk) {
      tags.push('MAILTO_ONLY_INTAKE');
      score += 15;
    } else if (!hasFormOrIntake) {
      tags.push('NO_VISIBLE_FORM');
      score += 10;
    }
    if (missingViewportMeta) {
      tags.push('MISSING_MOBILE_VIEWPORT');
      score += 10;
    }

    return {
      site_status: `HTTP_${res.status}`,
      response_time_ms: elapsedMs,
      has_booking_link: hasBookingLink ? 'TRUE' : 'FALSE',
      booking_provider_detected:
        matchedProviders.join('; ') || (hasBookingKeyword ? 'KEYWORD_MATCH' : ''),
      has_form_or_intake: hasFormOrIntake ? 'TRUE' : 'FALSE',
      form_count: formCount,
      mailto_only_risk: mailtoOnlyRisk ? 'TRUE' : 'FALSE',
      missing_viewport_meta: missingViewportMeta ? 'TRUE' : 'FALSE',
      friction_tags: tags.length > 0 ? tags.join(' | ') : 'BASELINE_OK',
      lead_priority_score: Math.min(score, 100),
      site_audit_notes: `Fetched in ${elapsedMs}ms (final URL: ${res.url})`,
    };
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startTime);
    const isTimeout = err.name === 'AbortError';

    return {
      site_status: isTimeout ? 'TIMEOUT' : 'FETCH_ERROR',
      response_time_ms: elapsedMs,
      has_booking_link: 'FALSE',
      booking_provider_detected: '',
      has_form_or_intake: 'FALSE',
      form_count: 0,
      mailto_only_risk: 'FALSE',
      missing_viewport_meta: 'FALSE',
      friction_tags: isTimeout ? 'SITE_TIMEOUT_SLOW' : 'SITE_UNREACHABLE',
      lead_priority_score: 75,
      site_audit_notes: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 4. CONCURRENCY POOL & PIPELINE RUNNER
// ============================================================================

async function processWithConcurrency(items, workerFn, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) break;

      results[currentIndex] = await workerFn(items[currentIndex], currentIndex);

      if (CONFIG.delayBetweenBatchesMs > 0) {
        await new Promise((r) => setTimeout(r, CONFIG.delayBetweenBatchesMs));
      }
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(pool);
  return results;
}

async function readCsv(filePath) {
  const rows = [];
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  for await (const row of parser) {
    rows.push(row);
  }
  return rows;
}

async function writeCsv(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await new Promise((resolve, reject) => {
    const stringifier = stringify({ header: true });
    const writable = fs.createWriteStream(filePath);
    stringifier.pipe(writable);

    for (const record of records) {
      stringifier.write(record);
    }
    stringifier.end();
    writable.on('finish', resolve);
    writable.on('error', reject);
  });
}

async function run() {
  if (!fs.existsSync(CONFIG.inputCsv)) {
    console.error(`Input CSV not found: ${CONFIG.inputCsv}`);
    process.exit(1);
  }

  const inputRows = await readCsv(CONFIG.inputCsv);
  console.log(`[LOAD] Read ${inputRows.length} filtered SBA borrowers from ${CONFIG.inputCsv}`);

  const enrichedRows = await processWithConcurrency(
    inputRows,
    async (row, idx) => {
      const placeData = await lookupPlaceDetails(row);
      const siteData = await auditWebsite(placeData.website_url);

      // Boost priority if high review volume + missing booking or acquisition flag
      let compositeScore = siteData.lead_priority_score;
      if (placeData.google_review_count >= 50 && siteData.has_booking_link === 'FALSE') {
        compositeScore = Math.min(compositeScore + 10, 100);
      }
      if (row.is_acquisition === 'TRUE') {
        compositeScore = Math.min(compositeScore + 5, 100);
      }

      if ((idx + 1) % 25 === 0 || idx + 1 === inputRows.length) {
        console.log(`[PROGRESS] Processed ${idx + 1} / ${inputRows.length}`);
      }

      return {
        ...row,
        ...placeData,
        ...siteData,
        lead_priority_score: compositeScore,
      };
    },
    CONFIG.concurrency
  );

  // Sort highest outreach priority first
  enrichedRows.sort((a, b) => b.lead_priority_score - a.lead_priority_score);

  await writeCsv(CONFIG.outputCsv, enrichedRows);
  console.log(`[DONE] Saved ${enrichedRows.length} enriched prospects to ${CONFIG.outputCsv}`);
}

run().catch((err) => {
  console.error('Enrichment pipeline failed:', err);
  process.exit(1);
});
