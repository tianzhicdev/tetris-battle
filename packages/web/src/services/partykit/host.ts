const DEFAULT_PARTYKIT_HOST = 'localhost:1999';

/**
 * Accepts either host-only values (recommended) or full URLs and returns a host
 * value compatible with PartySocket's `host` option.
 */
export function normalizePartykitHost(rawHost?: string): string {
  const input = (rawHost || '').trim();
  if (!input) return DEFAULT_PARTYKIT_HOST;

  // Already host:port or hostname.
  if (!input.includes('://')) {
    return input.replace(/\/+$/, '').split('/')[0];
  }

  try {
    const url = new URL(input);
    return url.host;
  } catch {
    return DEFAULT_PARTYKIT_HOST;
  }
}

