import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';

export type AgentServiceTier = 'tier1' | 'tier2' | 'tier3';

export interface AgentStepTrace {
  id: 'discovery' | 'audit_qualify' | 'outreach';
  label: string;
  status: 'passed' | 'warning' | 'failed';
  duration_ms: number;
  detail: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AgentProspectPayload {
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
  airtable_record_id: string;
}

export interface AgentOutreachKit {
  recommended_tier: AgentServiceTier;
  qualification_rationale: string;
  subject_line: string;
  email_1: string;
  email_2_followup: string;
  call_opener_20s: string;
  voicemail_20s: string;
  loom_talking_points: string[];
}

export interface AgentCandidate {
  candidate_id: string;
  already_in_crm: boolean;
  existing_prospect_id?: string;
  site_title: string;
  prospect: AgentProspectPayload;
  outreach: AgentOutreachKit;
  sources: GroundingSource[];
}

export interface AgentRunResult {
  run_id: string;
  query: string;
  vertical: string;
  geography: string;
  created_at: string;
  steps: AgentStepTrace[];
  candidates: AgentCandidate[];
  grounding_sources: GroundingSource[];
}

export interface ExistingProspectInput {
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
  airtable_record_id: string;
}

const GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add GEMINI_API_KEY in Settings > Secrets to run the AI Prospecting Agent.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function cleanStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

export function extractDomain(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/^www\./, '');
}

export function computeLeadScoreDeterministic(p: Partial<AgentProspectPayload>): number {
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

export function assignCampaignTrackDeterministic(p: Partial<AgentProspectPayload>): string {
  if (p.is_acquisition) return 'ACQUISITION_NEW_OPERATOR';
  if ((p.google_review_count || 0) >= 50 && !p.has_booking_link) return 'HIGH_REVIEW_LEAKY_FUNNEL';
  if (String(p.program || '').includes('504')) return 'EXPANSION_504_OPS';
  return 'STANDARD_SBA_INTAKE';
}

export function recommendTierDeterministic(p: Partial<AgentProspectPayload>): AgentServiceTier {
  if ((p.gross_approval || 0) >= 1_100_000 || (p.loan_count || 1) > 1) return 'tier3';
  if (
    p.site_status === 'HTTP_200' &&
    p.has_form_or_intake &&
    !p.missing_viewport_meta &&
    (p.response_time_ms ?? 9999) < 2500
  ) {
    return 'tier1';
  }
  return 'tier2';
}

interface SiteProbeResult {
  site_status: string;
  response_time_ms: number | null;
  has_booking_link: boolean;
  has_form_or_intake: boolean;
  mailto_only_risk: boolean;
  missing_viewport_meta: boolean;
  friction_tags: string;
  site_title: string;
}

async function probeWebsiteFriction(rawUrl: string): Promise<SiteProbeResult> {
  const urlStr = cleanStr(rawUrl);
  if (!urlStr) {
    return {
      site_status: 'NO_WEBSITE',
      response_time_ms: null,
      has_booking_link: false,
      has_form_or_intake: false,
      mailto_only_risk: false,
      missing_viewport_meta: false,
      friction_tags: 'NO_WEBSITE_OPPORTUNITY',
      site_title: '',
    };
  }

  const normalizedUrl = /^https?:\/\//i.test(urlStr) ? urlStr : `https://${urlStr}`;
  if (normalizedUrl.includes('.example.com') || normalizedUrl.includes('.example.org')) {
    return {
      site_status: 'HTTP_200',
      response_time_ms: 2650,
      has_booking_link: false,
      has_form_or_intake: true,
      mailto_only_risk: false,
      missing_viewport_meta: true,
      friction_tags: 'MISSING_INSTANT_BOOKING | SLOW_SERVER_RESPONSE | MISSING_MOBILE_VIEWPORT',
      site_title: '',
    };
  }

  const start = Date.now();
  try {
    const resp = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CocoClubLiveAudit/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const elapsed = Date.now() - start;
    const html = (await resp.text()).slice(0, 140_000);
    const lower = html.toLowerCase();

    const titleMatch = html.match(/<title[^>]*>([^<]{1,140})<\/title>/i);
    const siteTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasBooking =
      /(calendly\.com|acuityscheduling|servicetitan|housecallpro|getjobber|janeapp|zocdoc|setmore|vagaro|mindbody|appointy|square\.site\/book|book[\s_-]?(now|online|appointment|estimate)|schedule[\s_-]?(now|online|service|call))/i.test(
        lower
      );
    const hasForm =
      /<form\b/i.test(lower) ||
      /(hsforms\.net|hubspot|typeform|jotform|tally\.so|gravityforms|wpforms|contact-form-7|wpcf7|cognitoforms|wufoo)/i.test(
        lower
      );
    const hasMailto = /href=["']mailto:/i.test(lower);
    const mailtoOnly = hasMailto && !hasForm && !hasBooking;

    const tags: string[] = [];
    if (!resp.ok) tags.push(`HTTP_${resp.status}_ERROR`);
    if (!hasBooking) tags.push('MISSING_INSTANT_BOOKING');
    if (elapsed >= 2500) tags.push('SLOW_SERVER_RESPONSE');
    if (mailtoOnly) tags.push('MAILTO_ONLY_INTAKE');
    else if (!hasForm) tags.push('NO_WEB_INTAKE_FORM');
    if (!hasViewport) tags.push('MISSING_MOBILE_VIEWPORT');
    if (tags.length === 0) tags.push('BASELINE_OK');

    return {
      site_status: resp.ok ? 'HTTP_200' : `HTTP_${resp.status}`,
      response_time_ms: elapsed,
      has_booking_link: hasBooking,
      has_form_or_intake: hasForm,
      mailto_only_risk: mailtoOnly,
      missing_viewport_meta: !hasViewport,
      friction_tags: tags.join(' | '),
      site_title: siteTitle,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || /abort|timeout/i.test(err.message));
    return {
      site_status: isTimeout ? 'TIMEOUT' : 'FETCH_ERROR',
      response_time_ms: isTimeout ? elapsed : null,
      has_booking_link: false,
      has_form_or_intake: false,
      mailto_only_risk: false,
      missing_viewport_meta: false,
      friction_tags: isTimeout ? 'SITE_TIMEOUT_RISK' : 'SITE_UNREACHABLE_OR_SSL_ERROR',
      site_title: '',
    };
  }
}

interface RawDiscoveredBusiness {
  company_name?: string;
  city?: string;
  state?: string;
  street?: string;
  zip?: string;
  website_url?: string;
  phone?: string;
  naics_code?: string;
  naics_description?: string;
  google_rating?: number | null;
  google_review_count?: number;
  owner_name?: string;
  owner_email?: string;
  estimated_loan_or_scale?: number;
  is_acquisition_or_transition?: boolean;
  program_hint?: string;
  discovery_note?: string;
}

function parseJsonArrayFromModelText(rawText: string): RawDiscoveredBusiness[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket <= firstBracket) {
    throw new Error('Agent discovery step did not return a JSON list of candidate businesses.');
  }
  const slice = cleaned.slice(firstBracket, lastBracket + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) {
    throw new Error('Agent discovery output was not an array.');
  }
  return parsed as RawDiscoveredBusiness[];
}

function extractGroundingSources(response: unknown): GroundingSource[] {
  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = cleanStr(chunk?.web?.uri);
    const title = cleanStr(chunk?.web?.title) || uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ title, uri });
    }
  }
  return sources;
}

export async function runProspectingAgent(params: {
  query: string;
  vertical?: string;
  geography?: string;
  acquisitionFocus?: boolean;
  maxCandidates?: number;
  existingProspects: Array<{ id: string; dedupe_id: string; normalized_domain: string; borr_name: string }>;
}): Promise<AgentRunResult> {
  const ai = getGeminiClient();
  const query = cleanStr(params.query) || 'Independent HVAC, plumbing, or commercial service operators needing web + booking automation';
  const vertical = cleanStr(params.vertical) || 'Trades, Dental/Medical & Commercial B2B';
  const geography = cleanStr(params.geography) || 'Atlanta, GA';
  const acquisitionFocus = Boolean(params.acquisitionFocus);
  const maxCandidates = Math.min(6, Math.max(2, Number(params.maxCandidates || 4)));

  const steps: AgentStepTrace[] = [];

  // --------------------------------------------------------------------------
  // STAGE 1: Real Web & Local Discovery with Google Search Grounding
  // --------------------------------------------------------------------------
  const t1 = Date.now();
  const discoveryPrompt = `You are a B2B prospecting researcher for Coco Club Live Web Automation Agency.
Search the web and find ${maxCandidates} real, independent local operating businesses matching this brief:
- Target Brief: ${query}
- Industry / Vertical Focus: ${vertical}
- Target City / State: ${geography}
- Priority Signal: ${acquisitionFocus ? 'Prioritize recently acquired, rebranded, expanding, or multi-truck/multi-chair local operators' : 'Established local owner-operated businesses with high customer demand and legacy websites'}

Strict exclusions:
- Exclude national chains, franchises (e.g. Roto-Rooter, Aspen Dental, ServiceMaster), REITs, real estate holding companies, or directories (Yelp/Angi/BBB/YellowPages).
- Only include real operating businesses with verifiable details from search results.

Return ONLY a valid JSON array (no markdown prose before or after) where each object has:
{
  "company_name": "string",
  "city": "string",
  "state": "2-letter US state code",
  "street": "string or empty",
  "zip": "5-digit zip or empty",
  "website_url": "canonical https:// business website URL (not yelp/facebook) or empty string if none",
  "phone": "E.164 or formatted phone or empty",
  "naics_code": "6-digit NAICS code string",
  "naics_description": "short industry label",
  "google_rating": number or null,
  "google_review_count": number (integer estimate from search if visible, else 0),
  "owner_name": "public founder/owner/operator name if found in search, else empty string",
  "owner_email": "public contact email if found, else empty string",
  "estimated_loan_or_scale": number (estimated annual/SBA project scale in USD between 350000 and 1500000 based on size/locations),
  "is_acquisition_or_transition": boolean,
  "program_hint": "7a" or "504",
  "discovery_note": "1 short factual sentence from search"
}`;

  const discoveryResp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: discoveryPrompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const groundingSources = extractGroundingSources(discoveryResp);
  const rawList = parseJsonArrayFromModelText(discoveryResp.text || '');
  const trimmedList = rawList.slice(0, maxCandidates);

  steps.push({
    id: 'discovery',
    label: 'Web & Local Discovery (Google Search)',
    status: trimmedList.length > 0 ? 'passed' : 'warning',
    duration_ms: Date.now() - t1,
    detail: `Discovered ${trimmedList.length} candidate(s) · ${groundingSources.length} grounded web source(s)`,
  });

  // --------------------------------------------------------------------------
  // STAGE 2: Live HTTP Site Friction Audit & Deterministic SBA Qualification
  // --------------------------------------------------------------------------
  const t2 = Date.now();
  const audited = await Promise.all(
    trimmedList.map(async (raw, idx) => {
      const borrName = (cleanStr(raw.company_name) || `PROSPECT ${idx + 1}`).toUpperCase();
      const borrCity = cleanStr(raw.city) || geography.split(',')[0]?.trim() || 'Atlanta';
      const borrState = (cleanStr(raw.state) || geography.split(',')[1]?.trim() || 'GA').toUpperCase().slice(0, 2);
      const borrStreet = cleanStr(raw.street).toUpperCase();
      const borrZip = cleanStr(raw.zip).replace(/\D/g, '').slice(0, 5);
      const websiteUrl = cleanStr(raw.website_url);
      const domain = extractDomain(websiteUrl);

      const probe = await probeWebsiteFriction(websiteUrl);

      const cleanName = borrName
        .replace(/\b(LLC|INC|CORP|CORPORATION|LTD|CO|COMPANY|PLLC|PC|PA|LP)\b/g, '')
        .replace(/[^A-Z0-9]/g, '');
      const cleanStreet = borrStreet.replace(/[^A-Z0-9]/g, '').slice(0, 15);
      const dedupeId = crypto
        .createHash('sha256')
        .update(`${cleanName}|${cleanStreet || domain}|${borrZip || borrState}`)
        .digest('hex')
        .slice(0, 16);

      const grossApproval = Math.min(2_500_000, Math.max(250_000, Number(raw.estimated_loan_or_scale || 625_000)));
      const program = (raw.program_hint === '504' ? '504' : '7a') as '7a' | '504';
      const isAcquisition = Boolean(raw.is_acquisition_or_transition || acquisitionFocus);

      const payload: AgentProspectPayload = {
        dedupe_id: dedupeId,
        program,
        loan_count: 1,
        borr_name: borrName,
        borr_street: borrStreet,
        borr_city: borrCity,
        borr_state: borrState,
        borr_zip: borrZip,
        approval_date: '2026-06-15',
        gross_approval: grossApproval,
        naics_code: cleanStr(raw.naics_code).replace(/\D/g, '').slice(0, 6) || '238220',
        naics_description: cleanStr(raw.naics_description) || vertical,
        is_acquisition: isAcquisition,
        google_rating: typeof raw.google_rating === 'number' ? raw.google_rating : null,
        google_review_count: Math.max(0, Math.round(Number(raw.google_review_count || 0))),
        google_phone: cleanStr(raw.phone),
        website_url: websiteUrl,
        normalized_domain: domain,
        site_status: probe.site_status,
        response_time_ms: probe.response_time_ms,
        has_booking_link: probe.has_booking_link,
        has_form_or_intake: probe.has_form_or_intake,
        mailto_only_risk: probe.mailto_only_risk,
        missing_viewport_meta: probe.missing_viewport_meta,
        friction_tags: probe.friction_tags,
        owner_name: cleanStr(raw.owner_name),
        owner_email: cleanStr(raw.owner_email),
        owner_phone: cleanStr(raw.phone),
        computed_lead_score: 0,
        campaign_track: '',
        airtable_record_id: `rec${dedupeId.slice(0, 8)}`,
      };

      payload.computed_lead_score = computeLeadScoreDeterministic(payload);
      payload.campaign_track = assignCampaignTrackDeterministic(payload);

      const matchedExisting = params.existingProspects.find(
        (ep) =>
          ep.dedupe_id === dedupeId ||
          (domain && ep.normalized_domain && ep.normalized_domain === domain) ||
          ep.borr_name === borrName
      );

      return {
        candidate_id: `cand_${dedupeId}`,
        already_in_crm: Boolean(matchedExisting),
        existing_prospect_id: matchedExisting?.id,
        site_title: probe.site_title,
        discovery_note: cleanStr(raw.discovery_note),
        recommended_tier_deterministic: recommendTierDeterministic(payload),
        prospect: payload,
      };
    })
  );

  const avgScore =
    audited.length > 0
      ? Math.round(audited.reduce((acc, c) => acc + c.prospect.computed_lead_score, 0) / audited.length)
      : 0;

  steps.push({
    id: 'audit_qualify',
    label: 'Live Site Audit & Deterministic Qualification',
    status: 'passed',
    duration_ms: Date.now() - t2,
    detail: `Probed ${audited.length} site(s) · avg deterministic score ${avgScore}/100`,
  });

  // --------------------------------------------------------------------------
  // STAGE 3: Personalized Multi-Channel Outreach Synthesis (Structured Schema)
  // --------------------------------------------------------------------------
  const t3 = Date.now();
  const outreachInput = audited.map((a) => ({
    candidate_id: a.candidate_id,
    company_name: a.prospect.borr_name,
    city: a.prospect.borr_city,
    state: a.prospect.borr_state,
    industry: a.prospect.naics_description,
    owner_name: a.prospect.owner_name || 'Operator',
    website_url: a.prospect.website_url || 'NO_WEBSITE',
    site_title: a.site_title,
    site_status: a.prospect.site_status,
    response_time_ms: a.prospect.response_time_ms,
    has_booking_link: a.prospect.has_booking_link,
    has_form_or_intake: a.prospect.has_form_or_intake,
    mailto_only_risk: a.prospect.mailto_only_risk,
    missing_viewport_meta: a.prospect.missing_viewport_meta,
    friction_tags: a.prospect.friction_tags,
    google_review_count: a.prospect.google_review_count,
    google_rating: a.prospect.google_rating,
    computed_lead_score: a.prospect.computed_lead_score,
    campaign_track: a.prospect.campaign_track,
    recommended_tier: a.recommended_tier_deterministic,
    discovery_note: a.discovery_note,
  }));

  const outreachPrompt = `You are the senior outbound strategist at Coco Club Live Web Automation Agency.
Agency Tiers:
- tier1: Tier 1 Conversion & Intake Sprint ($3,500 one-time, 10 business days, mobile UX + 1 core lead-to-booking pipeline, 45-day 100% upgrade credit toward Tier 2).
- tier2: Tier 2 Full Revenue & Ops Engine ($7,500 setup + $650/mo Monthly Care, 3-4 weeks, up to 7 pages + 3 Make workflows: instant lead capture/SMS, calendar booking + reminders, review/follow-up loop).
- tier3: Tier 3 Custom Operations & Portal Suite ($14,500+ setup + $1,250/mo Engineering Retainer, 6-8 weeks, custom client portal + quoting/Stripe sync).

Voice & Rules:
- Concise, operator-to-operator, factual, zero fluff or marketing hype, no exclamation spam.
- Anchor every message in the REAL observed website audit facts (response_time_ms, friction_tags, missing instant booking, mailto-only risk, mobile viewport, or Google review demand).
- Never claim you already logged into their backend; offer a 90-second teardown Loom and two 15-minute review slots.
- Sign off emails as "Coco Club Live Web Automation Agency".

Generate structured qualification rationale and multi-channel outreach kits for each candidate below:
${JSON.stringify(outreachInput, null, 2)}`;

  const outreachResp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: outreachPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                candidate_id: { type: Type.STRING },
                recommended_tier: { type: Type.STRING, enum: ['tier1', 'tier2', 'tier3'] },
                qualification_rationale: { type: Type.STRING },
                subject_line: { type: Type.STRING },
                email_1: { type: Type.STRING },
                email_2_followup: { type: Type.STRING },
                call_opener_20s: { type: Type.STRING },
                voicemail_20s: { type: Type.STRING },
                loom_talking_points: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'candidate_id',
                'recommended_tier',
                'qualification_rationale',
                'subject_line',
                'email_1',
                'email_2_followup',
                'call_opener_20s',
                'voicemail_20s',
                'loom_talking_points',
              ],
            },
          },
        },
        required: ['kits'],
      },
    },
  });

  const parsedOutreach = JSON.parse(outreachResp.text || '{"kits":[]}') as {
    kits?: Array<AgentOutreachKit & { candidate_id: string }>;
  };
  const kitMap = new Map((parsedOutreach.kits || []).map((k) => [k.candidate_id, k]));

  const candidates: AgentCandidate[] = audited
    .map((a) => {
      const kit = kitMap.get(a.candidate_id);
      if (!kit) {
        throw new Error(`Missing outreach kit synthesis for ${a.prospect.borr_name}`);
      }
      return {
        candidate_id: a.candidate_id,
        already_in_crm: a.already_in_crm,
        existing_prospect_id: a.existing_prospect_id,
        site_title: a.site_title,
        prospect: a.prospect,
        outreach: {
          recommended_tier:
            kit.recommended_tier === 'tier1' || kit.recommended_tier === 'tier3'
              ? kit.recommended_tier
              : a.recommended_tier_deterministic,
          qualification_rationale: kit.qualification_rationale,
          subject_line: kit.subject_line,
          email_1: kit.email_1,
          email_2_followup: kit.email_2_followup,
          call_opener_20s: kit.call_opener_20s,
          voicemail_20s: kit.voicemail_20s,
          loom_talking_points: kit.loom_talking_points || [],
        },
        sources: groundingSources,
      };
    })
    .sort((a, b) => b.prospect.computed_lead_score - a.prospect.computed_lead_score);

  steps.push({
    id: 'outreach',
    label: 'Tier Fit & Outreach Kit Synthesis',
    status: 'passed',
    duration_ms: Date.now() - t3,
    detail: `Generated ${candidates.length} personalized 5-channel outreach kit(s)`,
  });

  return {
    run_id: `ag_${Date.now()}`,
    query,
    vertical,
    geography,
    created_at: new Date().toISOString(),
    steps,
    candidates,
    grounding_sources: groundingSources,
  };
}

export async function qualifyExistingProspectWithAgent(
  prospect: ExistingProspectInput
): Promise<AgentCandidate> {
  const ai = getGeminiClient();

  let probe: SiteProbeResult | null = null;
  if (prospect.website_url && !prospect.website_url.includes('.example.com')) {
    probe = await probeWebsiteFriction(prospect.website_url);
  }

  const updatedProspect: AgentProspectPayload = {
    dedupe_id: prospect.dedupe_id,
    program: prospect.program,
    loan_count: prospect.loan_count,
    borr_name: prospect.borr_name,
    borr_street: prospect.borr_street,
    borr_city: prospect.borr_city,
    borr_state: prospect.borr_state,
    borr_zip: prospect.borr_zip,
    approval_date: prospect.approval_date,
    gross_approval: prospect.gross_approval,
    naics_code: prospect.naics_code,
    naics_description: prospect.naics_description,
    is_acquisition: prospect.is_acquisition,
    google_rating: prospect.google_rating,
    google_review_count: prospect.google_review_count,
    google_phone: prospect.google_phone,
    website_url: prospect.website_url,
    normalized_domain: prospect.normalized_domain,
    site_status: probe ? probe.site_status : prospect.site_status,
    response_time_ms: probe ? probe.response_time_ms : prospect.response_time_ms,
    has_booking_link: probe ? probe.has_booking_link : prospect.has_booking_link,
    has_form_or_intake: probe ? probe.has_form_or_intake : prospect.has_form_or_intake,
    mailto_only_risk: probe ? probe.mailto_only_risk : prospect.mailto_only_risk,
    missing_viewport_meta: probe ? probe.missing_viewport_meta : prospect.missing_viewport_meta,
    friction_tags: probe ? probe.friction_tags : prospect.friction_tags,
    owner_name: prospect.owner_name,
    owner_email: prospect.owner_email,
    owner_phone: prospect.owner_phone,
    computed_lead_score: 0,
    campaign_track: '',
    airtable_record_id: prospect.airtable_record_id,
  };

  updatedProspect.computed_lead_score = computeLeadScoreDeterministic(updatedProspect);
  updatedProspect.campaign_track = assignCampaignTrackDeterministic(updatedProspect);
  const deterministicTier = recommendTierDeterministic(updatedProspect);

  const prompt = `You are the senior outbound strategist at Coco Club Live Web Automation Agency.
Generate a bespoke qualification summary and 5-asset outreach kit for this existing SBA CRM prospect:
${JSON.stringify(
  {
    company_name: updatedProspect.borr_name,
    city: updatedProspect.borr_city,
    state: updatedProspect.borr_state,
    program: updatedProspect.program,
    gross_approval_usd: updatedProspect.gross_approval,
    is_acquisition: updatedProspect.is_acquisition,
    industry: updatedProspect.naics_description,
    owner_name: updatedProspect.owner_name || 'Operator',
    website_url: updatedProspect.website_url || 'NO_WEBSITE',
    site_status: updatedProspect.site_status,
    response_time_ms: updatedProspect.response_time_ms,
    has_booking_link: updatedProspect.has_booking_link,
    mailto_only_risk: updatedProspect.mailto_only_risk,
    missing_viewport_meta: updatedProspect.missing_viewport_meta,
    friction_tags: updatedProspect.friction_tags,
    google_review_count: updatedProspect.google_review_count,
    google_rating: updatedProspect.google_rating,
    computed_lead_score: updatedProspect.computed_lead_score,
    campaign_track: updatedProspect.campaign_track,
    recommended_tier: deterministicTier,
  },
  null,
  2
)}

Agency Tiers:
- tier1: Tier 1 Conversion & Intake Sprint ($3,500 one-time, 10 business days, 45d 100% credit toward Tier 2).
- tier2: Tier 2 Full Revenue & Ops Engine ($7,500 setup + $650/mo Monthly Care, 3-4 weeks, 3 workflows).
- tier3: Tier 3 Custom Operations & Portal Suite ($14,500+ setup + $1,250/mo Retainer, 6-8 weeks, client portal + ERP/Stripe sync).

Voice: concise, matter-of-fact, boundary-clear, zero hype. Sign emails "Coco Club Live Web Automation Agency".`;

  const resp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommended_tier: { type: Type.STRING, enum: ['tier1', 'tier2', 'tier3'] },
          qualification_rationale: { type: Type.STRING },
          subject_line: { type: Type.STRING },
          email_1: { type: Type.STRING },
          email_2_followup: { type: Type.STRING },
          call_opener_20s: { type: Type.STRING },
          voicemail_20s: { type: Type.STRING },
          loom_talking_points: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'recommended_tier',
          'qualification_rationale',
          'subject_line',
          'email_1',
          'email_2_followup',
          'call_opener_20s',
          'voicemail_20s',
          'loom_talking_points',
        ],
      },
    },
  });

  const kit = JSON.parse(resp.text || '{}') as AgentOutreachKit;

  return {
    candidate_id: `cand_${updatedProspect.dedupe_id}`,
    already_in_crm: true,
    existing_prospect_id: prospect.id,
    site_title: probe?.site_title || '',
    prospect: updatedProspect,
    outreach: {
      recommended_tier:
        kit.recommended_tier === 'tier1' || kit.recommended_tier === 'tier3'
          ? kit.recommended_tier
          : deterministicTier,
      qualification_rationale: kit.qualification_rationale,
      subject_line: kit.subject_line,
      email_1: kit.email_1,
      email_2_followup: kit.email_2_followup,
      call_opener_20s: kit.call_opener_20s,
      voicemail_20s: kit.voicemail_20s,
      loom_talking_points: kit.loom_talking_points || [],
    },
    sources: [],
  };
}
