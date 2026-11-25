import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { usd, short } from '../format.js';
import { ArrowUpRight } from 'lucide-react';
import { Tape, TapeRow, StateChip, TxLink } from '../components/Tape.jsx';

/** Public proof (PRD §21 screen 6, FR-PRF-001). Everything here comes from GET /v1/proof (DB + chain). */
export default function Proof() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/v1/proof')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-danger">Could not load proof: {error}</div>;
  if (!data) return <p className="text-secondary">Loading…</p>;
  const { scout, totals, payments, refills } = data;

  return (
    <div>
      <h1 className="page-title">Live proof</h1>
      <p className="page-lead">
        Holdtil Scout is our own AI agent on Base mainnet. It pays for real market data over x402 in USDC. When its USDC runs low, Holdtil sells a small
        amount of stock at a fair price and tops it up. Every row below links to the real transaction.
      </p>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Scout wallet</div>
          <div className="stat-figure is-mono">
            {scout ? (
              <a href={`https://basescan.org/address/${scout.address}`} target="_blank" rel="noreferrer" className="text-decoration-none">
                {short(scout.address)} <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </a>
            ) : 'not set'}
          </div>
        </div>
        <div className="stat stat-key"><div className="stat-label">USDC float now</div><div className="stat-figure">{scout ? usd(scout.usdcBalance) : 'unavailable'}</div></div>
        <div className="stat"><div className="stat-label">x402 payments</div><div className="stat-figure">{totals.payments}</div><div className="stat-note">{usd(totals.paidUsdc)} paid</div></div>
        <div className="stat"><div className="stat-label">Refills</div><div className="stat-figure">{totals.refills}</div><div className="stat-note">{usd(totals.refilledUsdc)} topped up</div></div>
      </div>
      <p className="stat-note mt-2">Counts cover the {totals.window} records.</p>

      <div className="block-head"><h2 className="block-title">Refills and decisions</h2></div>
      {refills.length === 0 ? (
        <p className="empty">No refills yet.</p>
      ) : (
        <Tape>
          {refills.map((r, i) => (
            <TapeRow key={`${r.createdAt}-${i}`} r={r} />
          ))}
        </Tape>
      )}

      <div className="block-head"><h2 className="block-title">Scout&apos;s x402 payments</h2></div>
      {payments.length === 0 ? (
        <p className="empty">No payments yet.</p>
      ) : (
        <Tape>
          {payments.map((p, i) => (
            <li key={`${p.at}-${i}`} className="tape-row">
              <div className="tape-row-main">
                <StateChip state={p.status === 'paid' ? 'confirmed' : p.status} label={p.status} />
                <span className="tape-what">{p.costUsdc ? `${usd(p.costUsdc)} for market data` : 'Market data request'}</span>
                <time className="tape-time" dateTime={new Date(p.at).toISOString()}>{new Date(p.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              {p.summary && <div className="tape-reason">{p.summary}</div>}
              {p.txHash && <div className="tape-row-meta"><TxLink hash={p.txHash} /></div>}
            </li>
          ))}
        </Tape>
      )}
    </div>
  );
}
