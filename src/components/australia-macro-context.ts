import {
  ASX_MARKET_HOURS_METADATA,
  getAsxCashEquityStatus,
  type AsxCashEquityStatus,
} from '@/shared/asx-market-hours';
import {
  assessFinanceObservationProvenance,
  formatFinanceObservationProvenance,
  type FinanceObservationProvenanceAssessment,
} from '@/shared/finance-observation-provenance';
import {
  AUSTRALIA_DESK_MARKET_SYMBOLS,
  AUSTRALIA_DESK_RESOURCE_SYMBOLS,
  type AustraliaDeskObservation,
  type AustraliaMarketDeskSnapshot,
} from '@/services/australia-market-desk';
import { escapeHtml } from '@/utils/sanitize';

export interface AustraliaMacroContextModel {
  status: AsxCashEquityStatus;
  statusLabel: string;
  statusTone: string;
  sessionEvidence: FinanceObservationProvenanceAssessment;
  sessionEvidenceLabel: string;
  marketEvidence: FinanceObservationProvenanceAssessment;
  marketEvidenceLabel: string;
  resourceEvidence: FinanceObservationProvenanceAssessment;
  resourceEvidenceLabel: string;
  /** Compatibility alias for callers that previously consumed one combined quote evidence row. */
  quoteEvidence: FinanceObservationProvenanceAssessment;
  quoteEvidenceLabel: string;
  marketSymbols: readonly string[];
  resourceSymbols: readonly string[];
  warnings: string[];
}

function humanize(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function statusTone(status: AsxCashEquityStatus): string {
  if (status.session === 'regular') return '#27ae60';
  if (status.session === 'pre' || status.session === 'post') return '#3498db';
  if (status.session === 'holiday') return '#f39c12';
  if (status.session === 'unknown') return '#e67e22';
  return 'var(--text-dim)';
}

function genericQuoteEvidence(nowMs: number, group: string): FinanceObservationProvenanceAssessment {
  return assessFinanceObservationProvenance({
    provider: 'World Monitor market seed (Yahoo Finance path)',
    sourceClass: 'undocumented',
    sourceUrl: 'https://finance.yahoo.com/',
    maxAgeMs: 15 * 60 * 1000,
    transformation: {
      kind: 'normalized',
      description: 'Seeded quote normalized to World Monitor market fields',
      version: 'australia-market-desk-v1',
    },
    confidence: 0.35,
    notes: [
      `${group} quotes have not produced a usable retrieval clock in this panel session.`,
      'The current market API does not expose the upstream observation timestamp.',
    ],
  }, nowMs);
}

function representativeObservation(
  observations: readonly AustraliaDeskObservation[] | undefined,
): AustraliaDeskObservation | null {
  return observations?.find((entry) => entry.quote) ?? observations?.[0] ?? null;
}

function representativeEvidence(
  observations: readonly AustraliaDeskObservation[] | undefined,
  fallback: FinanceObservationProvenanceAssessment,
): FinanceObservationProvenanceAssessment {
  return representativeObservation(observations)?.provenance ?? fallback;
}

function buildFallbackSessionEvidence(
  now: Date,
  nowMs: number,
  status: AsxCashEquityStatus,
): FinanceObservationProvenanceAssessment {
  return assessFinanceObservationProvenance({
    provider: 'ASX',
    sourceClass: 'official',
    sourceUrl: ASX_MARKET_HOURS_METADATA.hoursSourceUrl,
    observedAt: now,
    maxAgeMs: 60_000,
    transformation: {
      kind: 'deterministic-model',
      description: 'ASX cash-market phase derived in Australia/Sydney from the verified calendar',
      version: 'asx-market-hours-v1',
    },
    confidence: status.calendarVerified ? 1 : 0.35,
    notes: [
      `Trading-hours and calendar sources last checked ${ASX_MARKET_HOURS_METADATA.sourceCheckedAt}.`,
      `Calendar source: ${ASX_MARKET_HOURS_METADATA.calendarSourceUrl}`,
      'The model evaluation time is not a live ASX schedule retrieval time.',
      status.calendarVerified
        ? 'The local ASX calendar year is verified.'
        : 'The local weekday calendar year is unverified; session state is intentionally unknown.',
    ],
  }, nowMs);
}

export function buildAustraliaMacroContextModel(
  now: Date = new Date(),
  snapshot: AustraliaMarketDeskSnapshot | null = null,
): AustraliaMacroContextModel {
  const nowMs = now.getTime();
  const status = snapshot?.asxStatus ?? getAsxCashEquityStatus(now);
  const sessionEvidence = snapshot?.asxStatusProvenance
    ?? buildFallbackSessionEvidence(now, nowMs, status);
  const marketEvidence = representativeEvidence(
    snapshot?.markets,
    genericQuoteEvidence(nowMs, 'ASX benchmark/bellwether'),
  );
  const resourceEvidence = representativeEvidence(
    snapshot?.resources,
    genericQuoteEvidence(nowMs, 'AUD/resource'),
  );

  const warnings = Array.from(new Set([
    ...(snapshot?.warnings ?? []),
    'Prices are delayed/seeded context, not exchange-grade real-time data.',
    'Retrieval/cache time must not be presented as exchange observation time.',
    'Confidence values are policy heuristics, not calibrated probabilities.',
  ]));
  if (!status.calendarVerified && !warnings.includes('ASX calendar year is unverified.')) {
    warnings.unshift('ASX calendar year is unverified.');
  }

  return {
    status,
    statusLabel: humanize(status.phase),
    statusTone: statusTone(status),
    sessionEvidence,
    sessionEvidenceLabel: formatFinanceObservationProvenance(sessionEvidence),
    marketEvidence,
    marketEvidenceLabel: formatFinanceObservationProvenance(marketEvidence),
    resourceEvidence,
    resourceEvidenceLabel: formatFinanceObservationProvenance(resourceEvidence),
    quoteEvidence: marketEvidence,
    quoteEvidenceLabel: formatFinanceObservationProvenance(marketEvidence),
    marketSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS,
    resourceSymbols: AUSTRALIA_DESK_RESOURCE_SYMBOLS,
    warnings,
  };
}

function evidenceRow(label: string, value: string, tone: string): string {
  return `<div style="display:grid;grid-template-columns:minmax(90px,0.28fr) 1fr;gap:8px;padding:7px 0;border-top:1px solid var(--border);font-size:10px;line-height:1.35">
    <strong style="color:${tone};text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(label)}</strong>
    <span style="color:var(--text-dim);overflow-wrap:anywhere">${escapeHtml(value)}</span>
  </div>`;
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (Math.abs(value) < 1) return value.toFixed(4);
  if (Math.abs(value) < 100) return value.toFixed(2);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function observationTone(observation: AustraliaDeskObservation): string {
  if (observation.quote === null) return '#e74c3c';
  if (observation.dataMode === 'cached' || observation.provenance.freshness === 'stale') return '#f39c12';
  if (observation.dataMode === 'unavailable' || observation.offline) return '#e67e22';
  if (observation.provenance.freshness === 'future' || observation.provenance.freshness === 'invalid') return '#e74c3c';
  return observation.quote.change !== null && observation.quote.change >= 0 ? '#27ae60' : '#e74c3c';
}

function freshnessBasisLabel(evidence: FinanceObservationProvenanceAssessment): string {
  if (evidence.freshnessBasis === 'observed-at') return 'observation clock';
  if (evidence.freshnessBasis === 'fetched-at') return 'fetch/cache clock';
  return 'no clock';
}

function dataModeLabel(observation: AustraliaDeskObservation | null): string {
  if (!observation) return 'Unknown mode';
  const mode = humanize(observation.dataMode);
  return observation.offline ? `${mode} · Offline` : mode;
}

function groupEvidenceLabel(
  observations: readonly AustraliaDeskObservation[] | undefined,
  provenanceLabel: string,
): string {
  return `${dataModeLabel(representativeObservation(observations))} · ${provenanceLabel}`;
}

function observationCard(observation: AustraliaDeskObservation): string {
  const tone = observationTone(observation);
  const price = formatPrice(observation.quote?.price ?? null);
  const change = observation.quote?.change;
  const changeLabel = change === null || change === undefined || !Number.isFinite(change)
    ? 'Change unavailable'
    : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  const sourceState = `${dataModeLabel(observation)} · ${humanize(observation.provenance.freshness)} · ${freshnessBasisLabel(observation.provenance)} · ${humanize(observation.provenance.sourceClass)}`;
  const flags = observation.provenance.flags
    .filter((flag) => [
      'unverified-access-method',
      'stale-observation',
      'missing-observed-at',
      'future-timestamp',
      'invalid-observed-at',
      'invalid-fetched-at',
    ].includes(flag))
    .map(humanize)
    .join(' · ');

  return `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:10px;min-width:0">
    <div style="display:flex;justify-content:space-between;gap:7px;align-items:flex-start">
      <div style="min-width:0">
        <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(observation.label)}</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px">${escapeHtml(observation.symbol)}</div>
      </div>
      <span style="font-size:8px;color:${tone};font-weight:700;text-transform:uppercase;white-space:nowrap">${escapeHtml(sourceState)}</span>
    </div>
    <div style="font-size:21px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;margin-top:6px">${escapeHtml(price)}</div>
    <div style="font-size:10px;color:${tone};font-weight:600;margin-top:2px">${escapeHtml(changeLabel)}</div>
    ${flags ? `<div style="font-size:8px;color:var(--text-dim);line-height:1.3;margin-top:5px">${escapeHtml(flags)}</div>` : ''}
  </div>`;
}

function observationSection(title: string, observations: readonly AustraliaDeskObservation[]): string {
  return `<div>
    <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">${escapeHtml(title)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px">${observations.map(observationCard).join('')}</div>
  </div>`;
}

function symbolSummary(model: AustraliaMacroContextModel): string {
  const marketLabels = model.marketSymbols.join(' · ');
  const resourceLabels = model.resourceSymbols.join(' · ');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:10px">
      <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">ASX benchmark & bellwethers</div>
      <div style="font-size:11px;color:var(--text);margin-top:5px;line-height:1.45">${escapeHtml(marketLabels)}</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:10px">
      <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Transmission channels</div>
      <div style="font-size:11px;color:var(--text);margin-top:5px;line-height:1.45">${escapeHtml(resourceLabels)}</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:10px">
      <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Context lenses</div>
      <div style="font-size:11px;color:var(--text);margin-top:5px;line-height:1.45">China demand · shipping · energy · sanctions · RBA/macro</div>
    </div>
  </div>`;
}

export function renderAustraliaMacroContext(
  model: AustraliaMacroContextModel,
  snapshot: AustraliaMarketDeskSnapshot | null = null,
): string {
  const localClock = model.status.localDate && model.status.localTime
    ? `${model.status.localDate} · ${model.status.localTime} Sydney`
    : 'Sydney time unavailable';
  const statusDetail = model.status.holidayName
    ? `${model.statusLabel} · ${model.status.holidayName}`
    : `${model.statusLabel} · ${humanize(model.status.reason)}`;
  const observations = snapshot
    ? `${observationSection('ASX benchmark & bellwethers', snapshot.markets)}${observationSection('AUD and resource transmission', snapshot.resources)}`
    : symbolSummary(model);
  const exportButton = snapshot
    ? '<button type="button" data-australia-context-export style="border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);border-radius:5px;padding:6px 8px;font-size:9px;font-weight:600;cursor:pointer;white-space:nowrap">Copy context JSON</button>'
    : '';
  const marketEvidenceLabel = snapshot
    ? groupEvidenceLabel(snapshot.markets, model.marketEvidenceLabel)
    : model.marketEvidenceLabel;
  const resourceEvidenceLabel = snapshot
    ? groupEvidenceLabel(snapshot.resources, model.resourceEvidenceLabel)
    : model.resourceEvidenceLabel;

  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:linear-gradient(135deg,rgba(39,174,96,0.09),rgba(52,152,219,0.04))">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div>
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">Australia / ASX Desk</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);margin-top:3px">${escapeHtml(statusDetail)}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:3px">${escapeHtml(localClock)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap">
          ${exportButton}
          <span style="font-size:10px;font-weight:700;color:${model.statusTone};border:1px solid ${model.statusTone};border-radius:999px;padding:4px 7px;text-transform:uppercase;white-space:nowrap">${escapeHtml(model.status.session)}</span>
        </div>
      </div>
    </div>

    ${observations}

    <div>
      ${evidenceRow('Session', model.sessionEvidenceLabel, '#27ae60')}
      ${evidenceRow('ASX basket', marketEvidenceLabel, '#f39c12')}
      ${evidenceRow('AUD/resources', resourceEvidenceLabel, '#f39c12')}
    </div>

    <div style="border:1px solid rgba(243,156,18,0.45);background:rgba(243,156,18,0.08);border-radius:6px;padding:9px 10px">
      ${model.warnings.map((warning) => `<div style="font-size:10px;color:var(--text-dim);line-height:1.45">• ${escapeHtml(warning)}</div>`).join('')}
    </div>
  </div>`;
}
