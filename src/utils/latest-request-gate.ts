/**
 * Monotonic newest-request-wins guard for stateful consumers.
 *
 * Starting or invalidating work advances the sequence. A caller may mutate
 * shared state only while its captured sequence remains current.
 */
export class LatestRequestGate {
  private _sequence = 0;

  public begin(): number {
    this._sequence += 1;
    return this._sequence;
  }

  public invalidate(): void {
    this._sequence += 1;
  }

  public isCurrent(sequence: number): boolean {
    return sequence === this._sequence;
  }
}
