import type {
  AustraliaDeskDataMode,
  AustraliaDeskObservation,
  AustraliaMarketDeskSnapshot,
  AustraliaQuoteGroupStatus,
  AustraliaSourceReviewStatus,
} from '@/services/australia-market-desk';
import {
  FINANCE_OBSERVATION_PROVENANCE_VERSION,
  type FinanceObservationProvenanceAssessment,
  type FinanceProvenanceFlag,
  type FinanceSourceClass,
  type FinanceTransformationKind,
} from '@/shared/finance-observation-provenance';

export const AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION = 'worldmonitor-australia-context-v1';

export type AustraliaContextAssetClass = 'index' | 'equity' | 'fx' | 'commodity';
export type AustraliaContextQuoteUnit =
  | 'index-points'
  | 'AUD-per-share'
  | 'USD-per-AUD'
  | 'provider-native';

export interface AustraliaContextEvidence {
  provenanceSchemaVersion: typeof FINANCE_OBSERVATION_PROVENANCE_VERSION;
  provider: string;
  sourceClass: FinanceSourceClass;
  sourceUrl: string | null;
  termsUrl: string | null;
  transformationKind: FinanceTransformationKind;
  transformationDescription: string | null;
  transformationVersion: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  freshnessBasis: FinanceObservationProvenanceAssessment['freshnessBasis'];
  ageMs: number | null;
  freshness: FinanceObservationProvenanceAssessment['freshness'];
  confidence: number | null;
  confidenceMeaning: 'policy-heuristic-not-calibrated';
  flags: FinanceProvenanceFlag[];
  notes: string[];
}

export interface AustraliaContextObservation {
  symbol: string;
  label: string;
  assetClass: AustraliaContextAssetClass;
  currency: string | null;
  quoteUnit: AustraliaContextQuoteUnit;
  quoteAvailable: boolean;
  price: number | null;
  changePercent: number | null;
  dataMode: AustraliaDeskDataMode;
  offline: boolean;
  latestAttemptMode: AustraliaDeskDataMode;
  latestAttemptOffline: boolean;
  evidence: AustraliaContextEvidence;
}

export interface AustraliaMarketContextExport {
  schemaVersion: typeof AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION;
  generatedAt: string;
  region: 'AU';
  intendedUse: 'read-only-research-context';
  asx: {
    phase: AustraliaMarketDeskSnapshot['asxStatus']['phase'];
    session: AustraliaMarketDeskSnapshot['asxStatus']['session'];
    reason: string;
    localDate: string | null;
    localTime: string | null;
    timeZone: string;
    calendarVerified: boolean;
    earlyClose: boolean;
    holidayName: string | null;
    sourceCheckedAt: string;
    sourceReviewAgeMs: number | null;
    sourceReviewStatus: AustraliaSourceReviewStatus;
    evidence: AustraliaContextEvidence;
  };
  quoteGroups: {
    equities: AustraliaQuoteGroupStatus;
    resources: AustraliaQuoteGroupStatus;
  };
  observations: AustraliaContextObservation[];
  missingSymbols: string[];
  warnings: string[];
  constraints: string[];
}

const READ_ONLY_CONSTRAINTS = Object.freeze([
  'Context only; not an investment recommendation.',
  'No order, position-size, target-price, or execution instruction is included.',
  'Retrieval/cache time is not a substitute for exchange observation time.',
  'Displayed-data state and latest refresh state must remain distinguishable.',
  'Undocumented, estimated, deterministic, and AI-derived evidence must remain distinguishable.',
  'Associations in downstream research must not be presented as proven causation.',
  'The equity basket is a compact benchmark/bellwether sample, not Australian market breadth or an investable universe.',
  'Provider-derived values are for internal research context; redistribution or republication requires a separate rights review.',
  'Confidence values are policy heuristics, not calibrated probabilities.',
]);

const QUOTE_METADATA: Readonly<Record<string, { currency: string | null; quoteUnit: AustraliaContextQuoteUnit }>> = {
  '^AXJO': { currency: null, quoteUnit: 'index-points' },
  'BHP.AX': { currency: 'AUD', quoteUnit: 'AUD-per-share' },
  'CBA.AX': { currency: 'AUD', quoteUnit: 'AUD-per-share' },
  'CSL.AX': { currency: 'AUD', quoteUnit: 'AUD-per-share' },
  'AUDUSD=X': { currency: 'USD', quoteUnit: 'USD-per-AUD' },
  'HG=F': { currency: null, quoteUnit: 'provider-native' },
  'GC=F': { currency: null, quoteUnit: 'provider-native' },
  'MTF=F': { currency: null, quoteUnit: 'provider-native' },
  'BZ=F': { currency: null, quoteUnit: 'provider-native' },
  'CL=F': { currency: null, quoteUnit: 'provider-native' },
  'NG=F': { currency: null, quoteUnit: 'provider-native' },
};

function timestampToIso(timestampMs: number | null): string | null {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return null;
  const date = new Date(timestampMs);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function exportEvidence(
  assessment: FinanceObservationProvenanceAssessment,
): AustraliaContextEvidence {
  return {
    provenanceSchemaVersion: FINANCE_OBSERVATION_PROVENANCE_VERSION,
    provider: assessment.provider,
    sourceClass: assessment.sourceClass,
    sourceUrl: assessment.sourceUrl,
    termsUrl: assessment.termsUrl,
    transformationKind: assessment.transformationKind,
    transformationDescription: assessment.transformationDescription,
    transformationVersion: assessment.transformationVersion,
    observedAt: timestampToIso(assessment.observedAtMs),
    fetchedAt: timestampToIso(assessment.fetchedAtMs),
    freshnessBasis: assessment.freshnessBasis,
    ageMs: assessment.ageMs,
    freshness: assessment.freshness,
    confidence: assessment.confidence,
    confidenceMeaning: 'policy-heuristic-not-calibrated',
    flags: [...assessment.flags],
    notes: [...assessment.notes],
  };
}

function classifyAsset(symbol: string): AustraliaContextAssetClass {
  if (symbol.startsWith('^')) return 'index';
  if (symbol.endsWith('.AX')) return 'equity';
  if (symbol.includes('=X')) return 'fx';
  return 'commodity';
}

function exportObservation(observation: AustraliaDeskObservation): AustraliaContextObservation {
  const metadata = QUOTE_METADATA[observation.symbol] ?? {
    currency: null,
    quoteUnit: 'provider-native' as const,
  };
  return {
    symbol: observation.symbol,
    label: observation.label,
    assetClass: classifyAsset(observation.symbol),
    currency: metadata.currency,
    quoteUnit: metadata.quoteUnit,
    quoteAvailable: observation.quote !== null,
    price: observation.quote?.price ?? null,
    changePercent: observation.quote?.change ?? null,
    dataMode: observation.dataMode,
    offline: observation.offline,
    latestAttemptMode: observation.latestAttemptMode,
    latestAttemptOffline: observation.latestAttemptOffline,
    evidence: exportEvidence(observation.provenance),
  };
}

function copyGroupStatus(status: AustraliaQuoteGroupStatus): AustraliaQuoteGroupStatus {
  return { ...status };
}

export function buildAustraliaMarketContextExport(
  snapshot: AustraliaMarketDeskSnapshot,
): AustraliaMarketContextExport {
  return {
    schemaVersion: AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION,
    generatedAt: snapshot.generatedAt,
    region: 'AU',
    intendedUse: 'read-only-research-context',
    asx: {
      phase: snapshot.asxStatus.phase,
      session: snapshot.asxStatus.session,
      reason: snapshot.asxStatus.reason,
      localDate: snapshot.asxStatus.localDate,
      localTime: snapshot.asxStatus.localTime,
      timeZone: snapshot.asxStatus.timeZone,
      calendarVerified: snapshot.asxStatus.calendarVerified,
      earlyClose: snapshot.asxStatus.earlyClose,
      holidayName: snapshot.asxStatus.holidayName,
      sourceCheckedAt: snapshot.asxSourceCheckedAt,
      sourceReviewAgeMs: snapshot.asxSourceReviewAgeMs,
      sourceReviewStatus: snapshot.asxSourceReviewStatus,
      evidence: exportEvidence(snapshot.asxStatusProvenance),
    },
    quoteGroups: {
      equities: copyGroupStatus(snapshot.marketGroupStatus),
      resources: copyGroupStatus(snapshot.resourceGroupStatus),
    },
    observations: [...snapshot.markets, ...snapshot.resources].map(exportObservation),
    missingSymbols: [...snapshot.missingSymbols],
    warnings: [...snapshot.warnings],
    constraints: [...READ_ONLY_CONSTRAINTS],
  };
}

export function serializeAustraliaMarketContextExport(
  context: AustraliaMarketContextExport,
): string {
  return `${JSON.stringify(context, null, 2)}\n`;
}
