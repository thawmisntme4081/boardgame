import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
// Tests run in English (the default language).
import './i18n';

afterEach(cleanup);

// jsdom has no Web Animations: the pieces' entrances and moves call `animate`, so tests get a stub
// that records the calls (and does nothing else).
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn(() => ({ cancel() {}, finish() {} }) as unknown as Animation);
}
