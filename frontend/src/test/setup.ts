import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock crypto.randomUUID for JSDOM
let counter = 0;
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${counter++}`,
  },
  writable: true,
});
