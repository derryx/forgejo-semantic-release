import type { Dispatcher } from 'undici';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const DEFAULT_BASE_URL = 'https://forgejo.example.com';

let mockAgent: MockAgent;
let originalDispatcher: Dispatcher;

/**
 * Create a mock pool for Forgejo API
 */
export function setupMockAgent(): MockAgent {
  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
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
  }
}

/**
 * Helper to create API path
 */
export function apiPath(path: string): string {
  return `/api/v1${path}`;
}
