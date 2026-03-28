export function extractQrToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const qrParam = url.searchParams.get('qr');
    if (qrParam) return qrParam.trim();

    const segments = url.pathname.split('/').filter(Boolean);
    const qrIndex = segments.findIndex((segment) => segment === 'qr');
    if (qrIndex >= 0 && segments[qrIndex + 1]) {
      return decodeURIComponent(segments[qrIndex + 1] as string).trim();
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function buildQrScanUrl(qrCode: string) {
  const baseUrl = (
    process.env.QR_APP_BASE_URL ||
    process.env.CORS_ORIGIN ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  return `${baseUrl}/qr/${encodeURIComponent(qrCode)}`;
}
