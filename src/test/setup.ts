import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock crypto.randomUUID for JSDOM
(window as any).crypto = {
  randomUUID: () => 'test-uuid',
};
