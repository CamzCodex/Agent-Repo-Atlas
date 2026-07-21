// Deterministic provenance and freshness assessment for finance observations.
//
// This module deliberately carries evidence instead of manufacturing a single
// "trust score". A licensed delayed quote, an estimated ETF-flow proxy, and an
// AI market implication can all be useful, but they are not the same kind of
// claim. Callers receive source class, transformation, age, and explicit flags
// so the UI or an agent can apply its own policy.
//
// Dependency-free by design: browser panels, server handlers, and tests can use
// the same implementation without importing generated API types.

export const FINANCE_OBSERVATION_PROVENANCE_VERSION = 'finance-observation-provenance-v1';

export type FinanceSourceClass =
  | 'official'
  | 'licensed'
  | 'public-api'
  | 'public-file'
  | 'rss'
  | 'undocumented'
  | 'scraped'
  | 'estimated'
  | 'unknown';

export type FinanceTransformationKind =
  | 'none'
  | 'normalized'
  | 'aggregated'
  | 'estimated'
  | 'deterministic-model'
  | 'ai-derived'
  | 'unknown';

export type FinanceObservationFreshness =
  | 'fresh'
  | 'stale'
  | 'future'
  | 'invalid'
  | 'unknown';

export type FinanceFreshnessBasis = 'observed-at' | 'fetched-at' | 'none';

export type FinanceProvenanceFlag =
  | 'unknown-provider'
  | 'unknown-source-class'
  | 'unverified-access-method'
  | 'estimated-value'
  | 'ai-derived-value'
  | 'missing-source-url'
  | 'missing-observed-at'
  | 'invalid-observed-at'
  | 'invalid-fetched-at'
  | 'missing-freshness-policy'
  | 'invalid-freshness-policy'
  | 'stale-observation'
  | 'future-timestamp'
  | 'low-confidence'
  | 'invalid-confidence';

export type FinanceTimestampInput = string | number | Date;

export interface FinanceObservationProvenanceInput {
  provider?: string;
  sourceClass?: FinanceSourceClass;
  sourceUrl?: string;
  termsUrl?: string;
  observedAt?: FinanceTimestampInput;
  fetchedAt?: FinanceTimestampInput;
  maxAgeMs?: number;
  futureToleranceMs?: number;
  transformation?: {
    kind?: FinanceTransformationKind;
    description?: string;
    version?: string;
  };
  confidence?: number;
  notes?: ReadonlyArray<string>;
}

export interface FinanceObservationProvenanceAssessment {
  schemaVersion: typeof FINANCE_OBSERVATION_PROVENANCE_VERSION;
  provider: string;
  sourceClass: FinanceSourceClass;
  sourceUrl: string | null;
  termsUrl: string | null;
  transformationKind: FinanceTransformationKind;
  transformationDescription: string | null;
  transformationVersion: string | null;
  observedAtMs: number | null;
  fetchedAtMs: number | null;
  freshnessBasis: FinanceFreshnessBasis;
  ageMs: number | null;
  freshness: FinanceObservationFreshness;
  confidence: number | null;
  flags: FinanceProvenanceFlag[];
  notes: string[];
}

const DEFAULT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const SOURCE_LABELS: Record<FinanceSourceClass, string> = {
  official: 'official',
  licensed: 'licensed',
  'public-api': 'public API',
  'public-file': 'public file',
  rss: 'RSS',
  undocumented: 'undocumented endpoint',
  scraped: 'scraped',
  estimated: 'estimated source',
  unknown: 'unknown source',
};

const TRANSFORMATION_LABELS: Record<FinanceTransformationKind, string> = {
  none: 'raw',
  normalized: 'normalized',
  aggregated: 'aggregated',
  estimated: 'estimated',
  'deterministic-model': 'model-derived',
  'ai-derived': 'AI-derived',
  unknown: 'unknown transform',
};

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function parseTimestamp(value: FinanceTimestampInput | undefined): number | null {
  if (value === undefined) return null;
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasTimestampInput(value: FinanceTimestampInput | undefined): boolean {
  if (value === undefined) return false;
  return typeof value !== 'string' || value.trim().length > 0;
}

function addFlag(flags: FinanceProvenanceFlag[], flag: FinanceProvenanceFlag): void {
  if (!flags.includes(flag)) flags.push(flag);
}

export function assessFinanceObservationProvenance(
  input: FinanceObservationProvenanceInput | null | undefined,
  nowMs: number = Date.now(),
): FinanceObservationProvenanceAssessment {
  const evidence = input ?? {};
  const flags: FinanceProvenanceFlag[] = [];
  const provider = cleanText(evidence.provider) ?? 'Unknown provider';
  const sourceClass = evidence.sourceClass ?? 'unknown';
  const sourceUrl = cleanText(evidence.sourceUrl);
  const termsUrl = cleanText(evidence.termsUrl);
  const transformationKind = evidence.transformation?.kind ?? 'unknown';
  const transformationDescription = cleanText(evidence.transformation?.description);
  const transformationVersion = cleanText(evidence.transformation?.version);
  const observedAtMs = parseTimestamp(evidence.observedAt);
  const fetchedAtMs = parseTimestamp(evidence.fetchedAt);

  if (provider === 'Unknown provider') addFlag(flags, 'unknown-provider');
  if (sourceClass === 'unknown') addFlag(flags, 'unknown-source-class');
  if (sourceClass === 'undocumented' || sourceClass === 'scraped') {
    addFlag(flags, 'unverified-access-method');
  }
  if (sourceClass === 'estimated' || transformationKind === 'estimated') {
    addFlag(flags, 'estimated-value');
  }
  if (transformationKind === 'ai-derived') addFlag(flags, 'ai-derived-value');
  if (!sourceUrl) addFlag(flags, 'missing-source-url');

  const observedProvided = hasTimestampInput(evidence.observedAt);
  const fetchedProvided = hasTimestampInput(evidence.fetchedAt);
  if (!observedProvided) addFlag(flags, 'missing-observed-at');
  else if (observedAtMs === null) addFlag(flags, 'invalid-observed-at');
  if (fetchedProvided && fetchedAtMs === null) addFlag(flags, 'invalid-fetched-at');

  let confidence: number | null = null;
  if (evidence.confidence !== undefined) {
    if (Number.isFinite(evidence.confidence) && evidence.confidence >= 0 && evidence.confidence <= 1) {
      confidence = evidence.confidence;
      if (confidence < 0.5) addFlag(flags, 'low-confidence');
    } else {
      addFlag(flags, 'invalid-confidence');
    }
  }

  let freshnessBasis: FinanceFreshnessBasis = 'none';
  let basisMs: number | null = null;
  if (observedAtMs !== null) {
    freshnessBasis = 'observed-at';
    basisMs = observedAtMs;
  } else if (fetchedAtMs !== null) {
    freshnessBasis = 'fetched-at';
    basisMs = fetchedAtMs;
  }

  const validNow = Number.isFinite(nowMs);
  const ageMs = validNow && basisMs !== null ? nowMs - basisMs : null;
  const futureToleranceMs = evidence.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS;
  const validFutureTolerance = Number.isFinite(futureToleranceMs) && futureToleranceMs >= 0;
  const maxAgeProvided = evidence.maxAgeMs !== undefined;
  const validMaxAge = Number.isFinite(evidence.maxAgeMs) && (evidence.maxAgeMs ?? -1) >= 0;

  let freshness: FinanceObservationFreshness;
  if (!validNow || basisMs === null) {
    freshness = observedProvided || fetchedProvided ? 'invalid' : 'unknown';
  } else if (!validFutureTolerance) {
    freshness = 'invalid';
    addFlag(flags, 'invalid-freshness-policy');
  } else if (ageMs !== null && ageMs < -futureToleranceMs) {
    freshness = 'future';
    addFlag(flags, 'future-timestamp');
  } else if (!maxAgeProvided) {
    freshness = 'unknown';
    addFlag(flags, 'missing-freshness-policy');
  } else if (!validMaxAge) {
    freshness = 'invalid';
    addFlag(flags, 'invalid-freshness-policy');
  } else if (ageMs !== null && ageMs > (evidence.maxAgeMs ?? 0)) {
    freshness = 'stale';
    addFlag(flags, 'stale-observation');
  } else {
    freshness = 'fresh';
  }

  return {
    schemaVersion: FINANCE_OBSERVATION_PROVENANCE_VERSION,
    provider,
    sourceClass,
    sourceUrl,
    termsUrl,
    transformationKind,
    transformationDescription,
    transformationVersion,
    observedAtMs,
    fetchedAtMs,
    freshnessBasis,
    ageMs,
    freshness,
    confidence,
    flags,
    notes: (evidence.notes ?? []).map((note) => note.trim()).filter(Boolean),
  };
}

function formatAge(ageMs: number | null): string | null {
  if (ageMs === null || !Number.isFinite(ageMs)) return null;
  const absoluteMs = Math.abs(ageMs);
  if (absoluteMs < 60_000) return ageMs < 0 ? '<1m ahead' : '<1m old';
  const minutes = Math.round(absoluteMs / 60_000);
  if (minutes < 60) return ageMs < 0 ? `${minutes}m ahead` : `${minutes}m old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return ageMs < 0 ? `${hours}h ahead` : `${hours}h old`;
  const days = Math.round(hours / 24);
  return ageMs < 0 ? `${days}d ahead` : `${days}d old`;
}

export function formatFinanceObservationProvenance(
  assessment: FinanceObservationProvenanceAssessment,
): string {
  const sourceLabel = SOURCE_LABELS[assessment.sourceClass];
  const transformationLabel = TRANSFORMATION_LABELS[assessment.transformationKind];
  const ageLabel = formatAge(assessment.ageMs);
  const freshnessLabel = ageLabel
    ? `${assessment.freshness} · ${ageLabel}`
    : assessment.freshness;
  return `${assessment.provider} · ${sourceLabel} · ${transformationLabel} · ${freshnessLabel}`;
}
