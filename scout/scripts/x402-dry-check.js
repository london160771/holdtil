// Gate 0 premise 5 (PRD §16): an x402 client can pay x402stock.xyz from a plain wallet on Base.
// DRY CHECK — no money can move:
//   1. Read the 402 payment requirements and check network = Base, asset = USDC.
//   2. Sign a real x402 payment with a brand-new, empty, in-memory wallet (key never saved or printed).
//      The server must reject it for lack of funds. That proves the client signs a payment the server
//      understands, without spending anything.
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const URL_TO_CALL = 'https://x402stock.xyz/api/v1/market-pulse';
const BASE = 'eip155:8453';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
const MAX_ATOMIC = 100_000n; // refuse anything above $0.10

function decodeHeader(value) {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
}

async function main() {
  const out = { url: URL_TO_CALL, at: new Date().toISOString() };

  // Step 1: unpaid request → 402 + requirements
  const res1 = await fetch(URL_TO_CALL);
  out.unpaidStatus = res1.status;
  const header = res1.headers.get('payment-required');
  if (res1.status !== 402 || !header) throw new Error(`expected 402 with payment-required, got ${res1.status}`);
  const reqs = decodeHeader(header);
  const accept = reqs.accepts.find((a) => a.network === BASE && a.asset.toLowerCase() === USDC);
  if (!accept) throw new Error('no Base USDC payment option offered');
  out.requirement = {
    x402Version: reqs.x402Version,
    scheme: accept.scheme,
    network: accept.network,
    asset: accept.asset,
    amountAtomic: accept.amount,
    payTo: accept.payTo,
  };

  // Step 2: sign a payment from an empty throwaway wallet; expect rejection
  const account = privateKeyToAccount(generatePrivateKey());
  out.throwawayAddress = account.address; // public address only
  const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: BASE, client: new ExactEvmScheme(account) }],
    paymentRequirementsSelector: (_v, options) => {
      const opt = options.find((o) => o.network === BASE && o.asset.toLowerCase() === USDC);
      if (!opt || BigInt(opt.amount) > MAX_ATOMIC) throw new Error('payment option refused by dry-check guard');
      return opt;
    },
  });
  const res2 = await paidFetch(URL_TO_CALL);
  out.paidStatus = res2.status;
  const text = await res2.text();
  try {
    const body = JSON.parse(text);
    out.serverReason = body.reason ?? null;
    out.serverError = body.error ?? null;
  } catch {
    out.serverReason = null;
  }
  const settle = res2.headers.get('payment-response');
  if (settle) out.paymentResponse = decodePaymentResponseHeader(settle);
  // Pass = the server parsed our signed payment and refused it only because the wallet is empty.
  out.pass = res2.status === 402 && out.serverReason === 'insufficient_funds';
  console.log(JSON.stringify(out, null, 2));
  if (!out.pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error('x402 dry check failed:', e.message);
  process.exitCode = 1;
});
