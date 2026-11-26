import { ArrowUpRight } from 'lucide-react';
import { usd, short } from '../format.js';
import { HoldGlyph } from './Brand.jsx';

// Plain words for the decision codes in PRD §11. The raw code is still shown beside it.
const WHY = {
  price_stale: 'Price too old, waited',
  price_gap_too_wide: 'Price off, waited',
  limit_exceeded: 'Limit reached',
  allowance_exhausted: 'Allowance used up',
  permission_revoked: 'Permission revoked',
  paused: 'Paused',
  simulation_failed: 'Test run failed, nothing sent',
  tx_failed: 'Transaction failed',
  refill_in_flight: 'Refill already running',
  refill_expired: 'Expired, will retry',
};

const STATE = {
  confirmed: { tone: 'ok', label: 'Sold' },
  sent: { tone: 'info', label: 'Sent' },
  waited: { tone: 'wait', label: 'Waited' },
  blocked: { tone: 'bad', label: 'Blocked' },
  failed: { tone: 'bad', label: 'Failed' },
};

export function stateOf(s) {
  return STATE[s] ?? { tone: 'muted', label: s };
}

/** A small status chip. Waits use the hold glyph from the logo. */
export function StateChip({ state, label }) {
  const s = stateOf(state);
  return (
    <span className={`chip chip-${s.tone}`}>
      {s.tone === 'wait' ? <HoldGlyph size={10} /> : <span className="chip-dot" />}
      {label ?? s.label}
    </span>
  );
}

export function TxLink({ hash }) {
  return (
    <a className="tx-link" href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">
      {short(hash)} <span className="visually-hidden">on BaseScan</span>
      <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
    </a>
  );
}

const when = (d) =>
  new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** One refill or decision, printed like a line of ticker tape. Every value comes from the API. */
export function TapeRow({ r }) {
  return (
    <li className="tape-row">
      <div className="tape-row-main">
        <StateChip state={r.state} />
        <span className="tape-what">
          {r.usdcOut ? <>+{usd(r.usdcOut)} USDC to the agent</> : r.code ? WHY[r.code] ?? r.code : r.state}
        </span>
        <time className="tape-time" dateTime={new Date(r.createdAt).toISOString()}>{when(r.createdAt)}</time>
      </div>
      {r.reason && <div className="tape-reason">{r.reason}</div>}
      <div className="tape-row-meta">
        {!r.usdcOut && r.simulatedUsdcOut && <span>simulated {usd(r.simulatedUsdcOut)}</span>}
        {r.gapBps && <span>gap {(Number(r.gapBps) / 100).toFixed(2)}% from reference</span>}
        {r.minOut && <span>min-out {usd(r.minOut)}</span>}
        {r.feeUsdcOut && <span>gas fee {usd(r.feeUsdcOut)}</span>}
        {r.code && <code>{r.code}</code>}
        {r.txHash && <TxLink hash={r.txHash} />}
      </div>
      {r.code && r.nextAction && r.state !== 'confirmed' && <div className="tape-next">Next: {r.nextAction}</div>}
    </li>
  );
}

export function Tape({ children }) {
  return <ul className="tape">{children}</ul>;
}
