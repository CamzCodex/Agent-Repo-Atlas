import type {
  AustraliaContextEvidence,
  AustraliaContextObservation,
  AustraliaMarketContextExport,
} from '@/services/australia-market-context-export';

export const WORLD_MONITOR_CONTEXT_V1_SCHEMA_VERSION = '1.0.0';

type ContextSourceClass =
  | 'official'
  | 'licensed'
  | 'public-api'
  | 'public-file'
  | 'rss'
  | 'undocumented'
  | 'scraped'
  | 'estimated'
  | 'deterministic'
  | 'statistical'
  | 'ai-derived';

type ContextDataState = 'live' | 'cached' | 'estimated' | 'unknown' | 'unavailable';

export interface WorldMonitorContextV1Rights {
  rightsPolicy: 'wm-internal-research-v1';
  cachePermission: 'internal-cache-allowed';
  retentionPolicy: 'runtime-run-archive-v1';
  exportPermission: 'internal-research-allowed';
}

export interface WorldMonitorContextV1Observation {
  observationId: string;
  measureId: string;
  measureLabel: string;
  value: number | string | null;
  unit: string | null;
  currency: string | null;
  scale: string | null;
  frequency: string | null;
  adjustment: string | null;
  transformation: string;
  entityIds: string[];
  instrumentIds: string[];
  geography: string[];
  criticality: 'standard' | 'critical';
  effectiveTime: string | null;
  observationTime: string | null;
  publicationTime: string | null;
  retrievalTime: string;
  ingestionTime: string;
  revisionTime: string | null;
  providerId: string;
  datasetId: string;
  sourceClass: ContextSourceClass;
  sourceUrl: string;
  termsUrl: string | null;
  attribution: string;
  rights: WorldMonitorContextV1Rights;
  requestId: string | null;
  requestKey: string | null;
  invocationSequence: number | null;
  requestStartedAt: string | null;
  requestCompletedAt: string | null;
  displayedDataState: ContextDataState;
  latestAttemptState: ContextDataState;
  offlineState: boolean;
  freshness: 'fresh' | 'stale' | 'unknown' | 'not-applicable';
  freshnessBasis:
    | 'observation-time'
    | 'publication-time'
    | 'retrieval-time'
    | 'ingestion-time'
    | 'deterministic-calendar';
  revisionStatus: 'original' | 'revised' | 'superseded' | 'unknown';
  qualityFlags: string[];
  completeness: number | null;
  coverage: string | null;
  limitations: string[];
}

export interface WorldMonitorContextV1Event {
  eventId: string;
  eventType: 'market-session';
  entityIds: string[];
  instrumentIds: string[];
  geography: string[];
  effectiveTime: string;
  publishedTime: string | null;
  retrievalTime: string;
  ingestionTime: string;
  revisionTime: string | null;
  providerId: string;
  datasetId: string;
  sourceClass: ContextSourceClass;
  evidenceLinks: string[];
  materialityFeatures: Record<string, string | number | boolean | null>;
  confidenceMeaning: string | null;
  confidenceValue: number | null;
  contradictoryEvidenceIds: string[];
  limitations: string[];
  rights: WorldMonitorContextV1Rights;
  aiDerived: false;
  generationMethod: 'deterministic-calendar';
}

export interface WorldMonitorContextV1Export {
  schemaVersion: typeof WORLD_MONITOR_CONTEXT_V1_SCHEMA_VERSION;
  payloadId: string;
  generatedAt: string;
  producer: {
    product: 'world-monitor';
    version: string;
    commit: string;
    environmentClass: 'development' | 'test' | 'staging' | 'production' | 'self-hosted';
  };
  purpose: 'read-only-research-context';
  controls: {
    readOnly: true;
    noRecommendation: true;
    noTarget: true;
    noSizing: true;
    noOrder: true;
    noBroker: true;
    noPortfolioMutation: true;
  };
  rightsSummary: {
    exportDecision: 'internal-research-allowed';
    blockedRecordCount: 0;
    policyId: 'wm-internal-research-v1';
  };
  observations: WorldMonitorContextV1Observation[];
  events: WorldMonitorContextV1Event[];
  claims: [];
  warnings: string[];
  unknowns: string[];
  dissentingEvidence: [];
}

export interface BuildWorldMonitorContextV1Options {
  version: string;
  commit: string;
  environmentClass: WorldMonitorContextV1Export['producer']['environmentClass'];
  payloadId?: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/=@+-]{0,127}$/;
const RIGHTS: WorldMonitorContextV1Rights = Object.freeze({
  rightsPolicy: 'wm-internal-research-v1',
  cachePermission: 'internal-cache-allowed',
  retentionPolicy: 'runtime-run-archive-v1',
  exportPermission: 'internal-research-allowed',
});

function safeId(value: string, prefix: string): string {
  const cleaned = value
    .trim()
    .replace(/^\^/, 'INDEX-')
    .replace(/[^A-Za-z0-9._:/=@+-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
  const result = `${prefix}${cleaned || 'unknown'}`.slice(0, 128);
  if (!SAFE_ID.test(result)) throw new Error(`Unable to create safe context identifier from ${value}.`);
  return result;
}

function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourceClass(evidence: AustraliaContextEvidence): ContextSourceClass | null {
  if (evidence.sourceClass === 'unknown') return null;
  if (evidence.transformationKind === 'deterministic-model') return 'deterministic';
  if (evidence.transformationKind === 'ai-derived') return 'ai-derived';
  return evidence.sourceClass;
}

function dataState(value: AustraliaContextObservation['dataMode']): ContextDataState {
  return value === 'live' || value === 'cached' || value === 'unavailable'
    ? value
    : 'unknown';
}

function observationFreshness(
  evidence: AustraliaContextEvidence,
): WorldMonitorContextV1Observation['freshness'] {
  return evidence.freshness === 'fresh' || evidence.freshness === 'stale'
    ? evidence.freshness
    : 'unknown';
}

function quoteObservation(
  item: AustraliaContextObservation,
  generatedAt: string,
): WorldMonitorContextV1Observation | null {
  const url = httpsUrl(item.evidence.sourceUrl);
  const classification = sourceClass(item.evidence);
  if (
    !item.quoteAvailable ||
    item.price === null ||
    !url ||
    !classification ||
    !item.evidence.observedAt ||
    item.evidence.freshness !== 'fresh'
  ) {
    return null;
  }

  const instrumentId = safeId(item.symbol, '');
  return {
    observationId: safeId(`${item.symbol}-price`, 'obs-'),
    measureId: safeId(`${item.assetClass}-price`, 'market.'),
    measureLabel: `${item.label} observed price`,
    value: item.price,
    unit: item.quoteUnit,
    currency: item.currency,
    scale: 'unit',
    frequency: 'provider-native',
    adjustment: null,
    transformation: item.evidence.transformationKind,
    entityIds: [instrumentId],
    instrumentIds: [instrumentId],
    geography: item.assetClass === 'equity' || item.assetClass === 'index' ? ['AU'] : ['GLOBAL'],
    criticality: 'critical',
    effectiveTime: item.evidence.observedAt,
    observationTime: item.evidence.observedAt,
    publicationTime: null,
    retrievalTime: item.evidence.fetchedAt ?? generatedAt,
    ingestionTime: generatedAt,
    revisionTime: null,
    providerId: safeId(item.evidence.provider, 'provider-'),
    datasetId: safeId(`${item.assetClass}-${item.symbol}`, 'dataset-'),
    sourceClass: classification,
    sourceUrl: url,
    termsUrl: httpsUrl(item.evidence.termsUrl),
    attribution: item.evidence.provider,
    rights: { ...RIGHTS },
    requestId: null,
    requestKey: safeId(`${item.assetClass}-${item.symbol}`, 'request-'),
    invocationSequence: null,
    requestStartedAt: null,
    requestCompletedAt: item.evidence.fetchedAt,
    displayedDataState: dataState(item.dataMode),
    latestAttemptState: dataState(item.latestAttemptMode),
    offlineState: item.offline,
    freshness: observationFreshness(item.evidence),
    freshnessBasis: 'observation-time',
    revisionStatus: 'unknown',
    qualityFlags: item.evidence.flags.map((flag) => safeId(flag, '')),
    completeness: 1,
    coverage: 'single instrument; compact context basket, not market breadth',
    limitations: [
      'Internal research context only; not an exchange-certified quote.',
      'The compact basket is not a point-in-time investable universe or market-breadth measure.',
    ],
  };
}

function asxSessionObservations(
  source: AustraliaMarketContextExport,
): WorldMonitorContextV1Observation[] {
  const url = httpsUrl(source.asx.evidence.sourceUrl);
  if (!url) return [];
  const providerId = safeId(source.asx.evidence.provider, 'provider-');
  const common = {
    currency: null,
    scale: 'binary',
    frequency: 'session',
    adjustment: null,
    transformation: 'deterministic-calendar',
    entityIds: ['ASX'],
    instrumentIds: [],
    geography: ['AU'],
    criticality: 'standard' as const,
    effectiveTime: source.generatedAt,
    observationTime: source.generatedAt,
    publicationTime: null,
    retrievalTime: source.generatedAt,
    ingestionTime: source.generatedAt,
    revisionTime: null,
    providerId,
    datasetId: 'dataset-asx-trading-calendar',
    sourceClass: 'official' as const,
    sourceUrl: url,
    termsUrl: httpsUrl(source.asx.evidence.termsUrl),
    attribution: source.asx.evidence.provider,
    rights: { ...RIGHTS },
    requestId: null,
    requestKey: null,
    invocationSequence: null,
    requestStartedAt: null,
    requestCompletedAt: null,
    displayedDataState: 'live' as const,
    latestAttemptState: 'live' as const,
    offlineState: false,
    freshness: 'not-applicable' as const,
    freshnessBasis: 'deterministic-calendar' as const,
    revisionStatus: 'original' as const,
    qualityFlags: source.asx.calendarVerified ? [] : ['calendar-unverified'],
    completeness: source.asx.calendarVerified ? 1 : 0.5,
    coverage: 'ASX cash-equity session state',
    limitations: [
      `Calendar source last reviewed ${source.asx.sourceCheckedAt}.`,
      'Deterministic session context is not a live exchange-status feed.',
    ],
  };
  const isOpen = source.asx.session === 'regular' ? 1 : 0;
  return [
    {
      ...common,
      observationId: 'obs-asx-session-open',
      measureId: 'market.session-open',
      measureLabel: 'ASX cash-equity session open flag',
      value: isOpen,
      unit: 'binary',
    },
    {
      ...common,
      observationId: 'obs-asx-early-close',
      measureId: 'market.early-close',
      measureLabel: 'ASX early-close flag',
      value: source.asx.earlyClose ? 1 : 0,
      unit: 'binary',
    },
    {
      ...common,
      observationId: 'obs-asx-calendar-verified',
      measureId: 'market.calendar-verified',
      measureLabel: 'ASX calendar verification flag',
      value: source.asx.calendarVerified ? 1 : 0,
      unit: 'binary',
    },
  ];
}

function asxSessionEvent(source: AustraliaMarketContextExport): WorldMonitorContextV1Event | null {
  const url = httpsUrl(source.asx.evidence.sourceUrl);
  if (!url) return null;
  return {
    eventId: safeId(`asx-session-${source.asx.localDate ?? source.generatedAt}`, 'event-'),
    eventType: 'market-session',
    entityIds: ['ASX'],
    instrumentIds: [],
    geography: ['AU'],
    effectiveTime: source.generatedAt,
    publishedTime: null,
    retrievalTime: source.generatedAt,
    ingestionTime: source.generatedAt,
    revisionTime: null,
    providerId: safeId(source.asx.evidence.provider, 'provider-'),
    datasetId: 'dataset-asx-trading-calendar',
    sourceClass: 'official',
    evidenceLinks: [url],
    materialityFeatures: {
      phase: source.asx.phase,
      session: source.asx.session,
      calendarVerified: source.asx.calendarVerified,
      earlyClose: source.asx.earlyClose,
      holidayName: source.asx.holidayName,
    },
    confidenceMeaning: null,
    confidenceValue: null,
    contradictoryEvidenceIds: [],
    limitations: [
      'Deterministic calendar interpretation; not a live exchange-status feed.',
      `Source review status: ${source.asx.sourceReviewStatus}.`,
    ],
    rights: { ...RIGHTS },
    aiDerived: false,
    generationMethod: 'deterministic-calendar',
  };
}

function defaultPayloadId(generatedAt: string): string {
  return safeId(generatedAt.replace(/[^0-9A-Za-z]+/g, '-'), 'wm-au-');
}

export function buildWorldMonitorContextV1(
  source: AustraliaMarketContextExport,
  options: BuildWorldMonitorContextV1Options,
): WorldMonitorContextV1Export {
  if (!options.version.trim()) throw new Error('World Monitor producer version is required.');
  if (!SAFE_ID.test(options.commit)) throw new Error('World Monitor producer commit must be a safe identifier.');
  if (options.payloadId && !SAFE_ID.test(options.payloadId)) throw new Error('World Monitor payloadId must be a safe identifier.');

  const quoteObservations = source.observations
    .map((item) => quoteObservation(item, source.generatedAt))
    .filter((item): item is WorldMonitorContextV1Observation => item !== null);
  const excludedQuotes = source.observations.length - quoteObservations.length;
  const sessionEvent = asxSessionEvent(source);

  return {
    schemaVersion: WORLD_MONITOR_CONTEXT_V1_SCHEMA_VERSION,
    payloadId: options.payloadId ?? defaultPayloadId(source.generatedAt),
    generatedAt: source.generatedAt,
    producer: {
      product: 'world-monitor',
      version: options.version,
      commit: options.commit,
      environmentClass: options.environmentClass,
    },
    purpose: 'read-only-research-context',
    controls: {
      readOnly: true,
      noRecommendation: true,
      noTarget: true,
      noSizing: true,
      noOrder: true,
      noBroker: true,
      noPortfolioMutation: true,
    },
    rightsSummary: {
      exportDecision: 'internal-research-allowed',
      blockedRecordCount: 0,
      policyId: 'wm-internal-research-v1',
    },
    observations: [...asxSessionObservations(source), ...quoteObservations],
    events: sessionEvent ? [sessionEvent] : [],
    claims: [],
    warnings: [
      ...source.warnings,
      ...(excludedQuotes > 0
        ? [
            `${excludedQuotes} quote observations were excluded because critical observation-time, freshness, source, value, or provenance requirements were not met.`,
          ]
        : []),
    ],
    unknowns: source.missingSymbols.map((symbol) => `No eligible observation exported for ${symbol}.`),
    dissentingEvidence: [],
  };
}

export function serializeWorldMonitorContextV1(context: WorldMonitorContextV1Export): string {
  return `${JSON.stringify(context, null, 2)}\n`;
}
