interface SafePreviewOptions {
  maskSensitive?: boolean;
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const ORDER_TOKEN_PATTERN = /\B#\d{3,}\b/g;
const ORDER_REFERENCE_PATTERN = /\border[\s#:-]*[a-z0-9-]{3,}\b/gi;

export const safePreview = (value: unknown, maxLen = 200, options: SafePreviewOptions = {}): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 200;
  const { maskSensitive = true } = options;

  let preview = value.trim();
  if (!preview) {
    return '';
  }

  if (maskSensitive) {
    preview = preview
      .replace(EMAIL_PATTERN, '[email]')
      .replace(PHONE_PATTERN, '[phone]')
      .replace(ORDER_REFERENCE_PATTERN, '[order_id]')
      .replace(ORDER_TOKEN_PATTERN, '[order_id]');
  }

  return preview.slice(0, limit);
};

