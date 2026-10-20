// In-memory stand-in for the parts of @base44/sdk the backend functions use.
// It models the service role (no RLS) only; entity RLS is NOT simulated here.
// The caller is chosen per request with the `x-test-user` header.

type Row = Record<string, any> & { id: string };
const tables = new Map<string, Map<string, Row>>();
let seq = 0;
export const sent: any[] = [];
export let llm: (args: any) => any = () => { throw new Error('LLM not configured in test'); };
export const setLlm = (fn: (args: any) => any) => { llm = fn; };

export function reset() { tables.clear(); sent.length = 0; seq = 0; }
const table = (name: string) => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name)!; };
export const rows = (name: string) => [...table(name).values()];
export function seed(name: string, data: Record<string, any>): Row {
  const id = data.id || `${name.toLowerCase()}_${++seq}`;
  const row = { created_date: new Date(Date.now() + seq).toISOString(), ...data, id };
  table(name).set(id, row);
  return row;
}

function matches(row: Row, q: Record<string, any>) {
  return Object.entries(q).every(([k, v]) => {
    const val = row[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v) return v.$in.includes(val);
      let ok = true;
      if ('$gte' in v) ok = ok && val !== undefined && val >= v.$gte;
      if ('$lte' in v) ok = ok && val !== undefined && val <= v.$lte;
      return ok;
    }
    return val === v;
  });
}

function handler(name: string) {
  return {
    async filter(q: Record<string, any>, opts: { sort?: string; limit?: number } = {}) {
      let items = rows(name).filter((r) => matches(r, q));
      if (opts.sort) {
        const desc = opts.sort.startsWith('-');
        const key = opts.sort.replace(/^-/, '');
        items.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (desc ? -1 : 1));
      }
      return { items: items.slice(0, opts.limit ?? 100) };
    },
    async get(id: string) {
      const r = table(name).get(id);
      if (!r) throw Object.assign(new Error('Not found'), { status: 404 });
      return { ...r };
    },
    async create(data: Record<string, any>) { return { ...seed(name, data) }; },
    async update(id: string, patch: Record<string, any>) {
      const r = table(name).get(id);
      if (!r) throw new Error('Not found');
      Object.assign(r, patch, { updated_date: new Date().toISOString() });
      return { ...r };
    },
    async delete(id: string) { table(name).delete(id); return { success: true }; },
  };
}

export function createClientFromRequest(req: Request) {
  const raw = req.headers.get('x-test-user');
  const caller = raw ? JSON.parse(raw) : null;
  const entities = new Proxy({}, { get: (_t, name: string) => handler(name) });
  return {
    auth: {
      async me() {
        if (!caller) return null;
        return { ...(table('User').get(caller.id) || {}), ...caller };
      },
    },
    asServiceRole: {
      entities,
      integrations: {
        Core: {
          async SendEmail(args: any) { sent.push(args); },
          async InvokeLLM(args: any) { return llm(args); },
        },
      },
    },
  };
}
