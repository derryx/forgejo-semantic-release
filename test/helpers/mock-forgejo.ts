import type { Dispatcher } from 'undici';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, fetch as undiciFetch } from 'undici';

const DEFAULT_BASE_URL = 'https://forgejo.example.com';

let mockAgent: MockAgent;
let originalDispatcher: Dispatcher;
let originalFetch: typeof globalThis.fetch;

/**
 * Create a mock pool for Forgejo API
 *
 * Node's built-in global `fetch` is backed by the undici bundled inside Node,
 * whose global dispatcher lives under `Symbol(undici.globalDispatcher.1)`.
 * The installed undici v8 reads/writes `Symbol(undici.globalDispatcher.2)`, so
 * `setGlobalDispatcher` here would never affect the built-in fetch. Point the
 * global `fetch` at undici's own implementation so it honours the MockAgent.
 */
export function setupMockAgent(): MockAgent {
  originalDispatcher = getGlobalDispatcher();
  originalFetch = globalThis.fetch;
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch;
  return mockAgent;
}

/**
 * Get or create mock pool for a base URL
 */
export function getMockPool(baseUrl: string = DEFAULT_BASE_URL) {
  if (!mockAgent) {
    setupMockAgent();
  }
  return mockAgent.get(baseUrl);
}

/**
 * Clean up mock agent
 */
export function cleanupMock(): void {
  if (mockAgent) {
    mockAgent.enableNetConnect();
    setGlobalDispatcher(originalDispatcher);
    globalThis.fetch = originalFetch;
  }
}

/**
 * Helper to create API path
 */
export function apiPath(path: string): string {
  return `/api/v1${path}`;
}
