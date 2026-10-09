import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// Tests run in English (the default language).
import './i18n';

afterEach(cleanup);
