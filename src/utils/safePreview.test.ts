import { safePreview } from './safePreview';

describe('safePreview', () => {
  it('returns trimmed text when shorter than max length', () => {
    expect(safePreview('   hello world   ', 50)).toBe('hello world');
  });

  it('truncates text to max length', () => {
    const longText = 'a'.repeat(300);
    expect(safePreview(longText, 200)).toBe('a'.repeat(200));
  });

  it('returns empty string for empty or non-string input', () => {
    expect(safePreview('   ', 100)).toBe('');
    expect(safePreview(undefined, 100)).toBe('');
  });

  it('masks sensitive email, phone, and order tokens', () => {
    const input = 'Reach me at test.user@example.com or +1 (555) 123-4567 about order #12345.';
    expect(safePreview(input, 200)).toBe('Reach me at [email] or [phone] about [order_id].');
  });
});
