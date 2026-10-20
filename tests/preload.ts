// Test-only shims so Base44 Deno functions run under `bun test`:
// - replaces the `npm:@base44/sdk@0.8.54` import with an in-memory fake
// - provides a minimal `Deno.env`
import { mock } from 'bun:test';
import * as fake from './fake-sdk.ts';

mock.module('npm:@base44/sdk@0.8.54', () => fake);
(globalThis as any).Deno = { env: { get: (k: string) => process.env[k] } };
