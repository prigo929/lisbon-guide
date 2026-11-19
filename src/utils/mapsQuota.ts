// Tier 2 Google Maps Platform Quota Defense helper
export function notifyMapsQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const text =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.status || JSON.stringify(err);
  const upper = String(text).toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVERQUOTAMAPERROR') ||
    upper.includes('QUOTAEXCEEDED') ||
    upper.includes('429')
  );
}

export function handleMapsApiError(err: unknown): boolean {
  if (isQuotaError(err)) {
    notifyMapsQuotaExceeded();
    return true;
  }
  return false;
}
