import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { usd, tokenAmount } from '../format.js';
import { Tape, TxLink } from './Tape.jsx';

const when = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Money in and money out for one agent wallet, newest first (spending log).
 * In = confirmed Holdtil refills (stock sold → USDC). Out = paid x402 calls (what the agent bought).
 * Every row comes from the API; nothing is computed except the order.
 */
export default function SpendLog({ refills = [], payments = [], stock = { symbol: 'NVDAc', decimals: 8 } }) {
  const rows = [
    ...refills.filter((r) => r.state === 'confirmed' && r.usdcOut).map((r) => ({ kind: 'in', at: r.createdAt, r })),
    ...payments.filter((p) => p.txHash && p.costUsdc).map((p) => ({ kind: 'out', at: p.at, p })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  if (rows.length === 0) return <p className="empty">No money in or out yet.</p>;

  const spent = payments.filter((p) => p.txHash && p.costUsdc).reduce((s, p) => s + BigInt(p.costUsdc), 0n);
  const topped = refills.filter((r) => r.state === 'confirmed' && r.usdcOut).reduce((s, r) => s + BigInt(r.usdcOut), 0n);
  const calls = payments.filter((p) => p.txHash && p.costUsdc).length;

  return (
    <>
      <p className="stat-note">
        Topped up {usd(topped)} from stock · spent {usd(spent)} on {calls} paid {calls === 1 ? 'call' : 'calls'} (rows below).
      </p>
      <Tape>
        {rows.map((x, i) =>
          x.kind === 'in' ? (
            <li key={`in-${x.at}-${i}`} className="tape-row">
              <div className="tape-row-main">
                <span className="chip chip-ok"><ArrowDownLeft size={12} strokeWidth={2} aria-hidden="true" />In</span>
                <span className="tape-what">
                  +{usd(x.r.usdcOut)} USDC{x.r.stockAmount ? <> from {tokenAmount(x.r.stockAmount, stock.decimals, x.r.stock ?? stock.symbol)}</> : null}
                </span>
                <time className="tape-time" dateTime={new Date(x.at).toISOString()}>{when(x.at)}</time>
              </div>
              <div className="tape-reason">Holdtil refill at a fair price</div>
              {x.r.txHash && <div className="tape-row-meta"><TxLink hash={x.r.txHash} /></div>}
            </li>
          ) : (
            <li key={`out-${x.at}-${i}`} className="tape-row">
              <div className="tape-row-main">
                <span className="chip chip-info"><ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />Out</span>
                <span className="tape-what">
                  −{usd(x.p.costUsdc)} for {x.p.item ? <code>{x.p.item}</code> : 'a paid API call'}
                  {x.p.seller ? <> from {x.p.seller}</> : null}
                </span>
                <time className="tape-time" dateTime={new Date(x.at).toISOString()}>{when(x.at)}</time>
              </div>
              {x.p.summary && <div className="tape-reason">Got: {x.p.summary}</div>}
              <div className="tape-row-meta">
                <span>x402 · {x.p.status === 'paid' ? 'paid, data received' : 'paid, no data'}</span>
                <TxLink hash={x.p.txHash} />
              </div>
            </li>
          ),
        )}
      </Tape>
    </>
  );
}
