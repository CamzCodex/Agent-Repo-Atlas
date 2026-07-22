export type ClipboardCopyStatus = 'copied' | 'failed' | 'cancelled' | 'busy';
export type ClipboardCopyMethod = 'clipboard' | 'textarea' | null;

export interface ClipboardCopyResult {
  status: ClipboardCopyStatus;
  method: ClipboardCopyMethod;
}

interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export interface ClipboardCopyEnvironment {
  clipboard?: ClipboardWriter | null;
  document?: Document | null;
}

export interface ClipboardCopyOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_CLIPBOARD_TIMEOUT_MS = 1_500;

function resolveClipboard(environment: ClipboardCopyEnvironment): ClipboardWriter | null {
  if (environment.clipboard !== undefined) return environment.clipboard;
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { clipboard?: Clipboard }).clipboard ?? null;
}

function resolveDocument(environment: ClipboardCopyEnvironment): Document | null {
  if (environment.document !== undefined) return environment.document;
  return typeof document === 'undefined' ? null : document;
}

function copyWithTextarea(text: string, documentRef: Document | null): boolean {
  if (!documentRef?.body) return false;
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  documentRef.body.appendChild(textarea);
  try {
    textarea.select();
    return typeof documentRef.execCommand === 'function' && documentRef.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function waitForClipboardWrite(
  writer: ClipboardWriter,
  text: string,
  timeoutMs: number,
  signals: readonly AbortSignal[],
): Promise<'copied' | 'failed' | 'cancelled'> {
  if (signals.some((signal) => signal.aborted)) return Promise.resolve('cancelled');

  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: 'copied' | 'failed' | 'cancelled'): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      for (const signal of signals) signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = (): void => finish('cancelled');

    for (const signal of signals) signal.addEventListener('abort', onAbort, { once: true });
    timeout = setTimeout(() => finish('failed'), Math.max(0, timeoutMs));

    Promise.resolve()
      .then(() => writer.writeText(text))
      .then(() => finish('copied'))
      .catch(() => finish('failed'));
  });
}

/**
 * Reusable single-flight clipboard controller with lifecycle cancellation.
 * Call destroy() from the owning component's teardown path.
 */
export class ClipboardCopyController {
  private _active = false;
  private _destroyed = false;
  private readonly _lifecycle = new AbortController();

  constructor(private readonly _environment: ClipboardCopyEnvironment = {}) {}

  public async copy(
    text: string,
    options: ClipboardCopyOptions = {},
  ): Promise<ClipboardCopyResult> {
    if (this._destroyed || this._lifecycle.signal.aborted || options.signal?.aborted) {
      return { status: 'cancelled', method: null };
    }
    if (this._active) return { status: 'busy', method: null };

    this._active = true;
    try {
      const signals = options.signal
        ? [this._lifecycle.signal, options.signal]
        : [this._lifecycle.signal];
      const writer = resolveClipboard(this._environment);
      if (writer) {
        const result = await waitForClipboardWrite(
          writer,
          text,
          options.timeoutMs ?? DEFAULT_CLIPBOARD_TIMEOUT_MS,
          signals,
        );
        if (result === 'copied') return { status: 'copied', method: 'clipboard' };
        if (result === 'cancelled') return { status: 'cancelled', method: null };
      }

      if (signals.some((signal) => signal.aborted)) {
        return { status: 'cancelled', method: null };
      }
      return copyWithTextarea(text, resolveDocument(this._environment))
        ? { status: 'copied', method: 'textarea' }
        : { status: 'failed', method: null };
    } finally {
      this._active = false;
    }
  }

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._lifecycle.abort();
  }
}
