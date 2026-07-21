import type {
  AustraliaDeskObservation,
  AustraliaMarketDeskSnapshot,
} from '@/services/australia-market-desk';
import type {
  FinanceObservationProvenanceAssessment,
  FinanceProvenanceFlag,
  FinanceSourceClass,
  FinanceTransformationKind,
} from '@/shared/finance-observation-provenance';

export const AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION = 'worldmonitor-australia-context-v1';

export type AustraliaContextAssetClass = 'index' | 'equity' | 'fx' | 'commodity';

export interface AustraliaContextEvidence {
  provider: string;
  sourceClass: FinanceSourceClass;
  sourceUrl: string | null;
  termsUrl: string | null;
  transformationKind: FinanceTransformationKind;
  transformationVersion: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  ageMs: number | null;
  freshness: FinanceObservationProvenanceAssessment['freshness'];
  confidence: number | null;
  flags: FinanceProvenanceFlag[];
  notes: string[];
}

export interface AustraliaContextObservation {
  symbol: string;
  label: string;
  assetClass: AustraliaContextAssetClass;
  quoteAvailable: boolean;
  price: number | null;
  changePercent: number | null;
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
    evidence: AustraliaContextEvidence;
  };
  observations: AustraliaContextObservation[];
  missingSymbols: string[];
  warnings: string[];
  constraints: string[];
}

const READ_ONLY_CONSTRAINTS = Object.freeze([
  'Context only; not an investment recommendation.',
  'No order, position-size, target-price, or execution instruction is included.',
  'Retrieval time is not a substitute for exchange observation time.',
  'Undocumented, estimated, deterministic, and AI-derived evidence must remain distinguishable.',
  'Associations in downstream research must not be presented as proven causation.',
]);

function timestampToIso(timestampMs: number | null): string | null {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return null;
  const date = new Date(timestampMs);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function exportEvidence(
  assessment: FinanceObservationProvenanceAssessment,
): AustraliaContextEvidence {
  return {
    provider: assessment.provider,
    sourceClass: assessment.sourceClass,
    sourceUrl: assessment.sourceUrl,
    termsUrl: assessment.termsUrl,
    transformationKind: assessment.transformationKind,
    transformationVersion: assessment.transformationVersion,
    observedAt: timestampToIso(assessment.observedAtMs),
    fetchedAt: timestampToIso(assessment.fetchedAtMs),
    ageMs: assessment.ageMs,
    freshness: assessment.freshness,
    confidence: assessment.confidence,
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
  return {
    symbol: observation.symbol,
    label: observation.label,
    assetClass: classifyAsset(observation.symbol),
    quoteAvailable: observation.quote !== null,
    price: observation.quote?.price ?? null,
    changePercent: observation.quote?.change ?? null,
    evidence: exportEvidence(observation.provenance),
  };
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
      evidence: exportEvidence(snapshot.asxStatusProvenance),
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
