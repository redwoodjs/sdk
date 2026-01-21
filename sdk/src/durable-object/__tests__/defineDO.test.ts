import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DurableObject, DurableObjectState } from "@cloudflare/workers-types";

// Mock DurableObject for testing
vi.mock('@cloudflare/workers-types', () => ({
  DurableObject: class DurableObject {
    constructor(public ctx: any, public env: any) {}
  }
}));

import { defineDO } from '../index';

describe('defineDO', () => {
  let mockState: DurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
      blockConcurrencyWhile: vi.fn((fn: () => Promise<void>) => fn()),
      id: {} as any,
      waitUntil: vi.fn(),
    } as unknown as DurableObjectState;
    
    mockEnv = { db: {} };
  });

  it('creates a Durable Object class', () => {
    const Counter = defineDO({
      state: { count: 0 },
      actions: {
        add() { this.setState({ count: this.state.count + 1 }); }
      }
    });
    
    expect(Counter).toBeDefined();
    expect(typeof Counter).toBe('function');
  });

  it('initializes with default state', async () => {
    const Counter = defineDO({
      state: { count: 0 },
      actions: {}
    });

    const instance = new (Counter as any)(mockState, mockEnv);
    
    const initFn = (mockState.blockConcurrencyWhile as any).mock.calls[0][0];
    await initFn();
    
    expect(instance.state).toEqual({ count: 0 });
  });

  it('executes actions and updates state', async () => {
    const Counter = defineDO({
      state: { count: 0 },
      actions: {
        add() { this.setState({ count: this.state.count + 1 }); }
      }
    });

    const instance = new (Counter as any)(mockState, mockEnv);
    const initFn = (mockState.blockConcurrencyWhile as any).mock.calls[0][0];
    await initFn();
    
    const request = new Request('http://test/action/add', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] })
    });
    const response = await instance.fetch(request);
    
    expect(instance.state.count).toBe(1);
    expect(response.status).toBe(200);
  });
});