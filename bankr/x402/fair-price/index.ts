// Bankr x402 Cloud handler (PRD FR-FPC-001). Bankr verifies and settles the $0.01 USDC payment;
// it settles only when this returns a status below 400.
// Env (set with `bankr x402 env set`): BASE_RPC_URL; HOLDTIL_CHECKS_URL + CHECK_SECRET to record checks on /proof.
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { fairPriceCheck, checkRecord, sendRecord } from './check.js';

export async function handle(req: Request, deps: { client?: any; fetchFn?: typeof fetch; env?: Record<string, string | undefined> } = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  let input: Record<string, unknown> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === 'POST') {
    try {
      input = { ...input, ...(await req.json()) };
    } catch {
      return Response.json({ error: { code: 'invalid_input', message: 'Body must be JSON', retryable: false, nextAction: 'Fix the input and try again (not charged)' } }, { status: 400 });
    }
  }
  if (!deps.client && !env.BASE_RPC_URL) {
    return Response.json({ error: { code: 'chain_unavailable', message: 'Service not configured', retryable: true, nextAction: 'Try again later (not charged)' } }, { status: 503 });
  }
  const client = deps.client ?? createPublicClient({ chain: base, transport: http(env.BASE_RPC_URL, { timeout: 10_000 }) });
  const { status, body } = await fairPriceCheck(client, input);
  if (status === 200) {
    const record = checkRecord({ checkId: crypto.randomUUID(), payer: req.headers.get('x-402-payer'), body });
    await sendRecord({ fetchFn: deps.fetchFn, url: env.HOLDTIL_CHECKS_URL, secret: env.CHECK_SECRET, record });
  }
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export default async function handler(req: Request): Promise<Response> {
  return handle(req);
}
