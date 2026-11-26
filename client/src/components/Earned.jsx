import { formatUnits } from 'viem';
import { usd, tokenAmount } from '../format.js';

const day = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const ago = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 90) return `${m} min old`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h old`;
  return `${Math.round(m / 1440)} days old`;
};
const price = (v, d) => `$${Number(formatUnits(BigInt(v), d)).toFixed(2)}`;

/** Signed USDC base units → "+$0.20" or "−$0.15". */
function signedUsd(v) {
  const n = BigInt(v);
  const abs = n < 0n ? -n : n;
  return `${n < 0n ? '−' : '+'}${usd(abs.toString())}`;
}

function pct(bps) {
  const n = Number(bps);
  return `${n < 0 ? '−' : '+'}${(Math.abs(n) / 100).toFixed(2)}%`;
}

/**
 * "Earned while waiting" (PRD §16). Budget kept in stock vs the same stock as idle USDC at the start price.
 * Every number comes from the API (DB + chain). Unknown → "unavailable".
 */
export default function Earned({ earned, subject = 'Your budget' }) {
  if (earned === undefined || earned === null) return null;
  if (earned === 'unavailable') {
    return (
      <div className="earned">
        <div className="stat-label">Earned while waiting</div>
        <div className="stat-figure">unavailable</div>
      </div>
    );
  }
  if (earned.length === 0) return null;
  return (
    <div className="earned-list">
      {earned.map((e) => (
        <div key={e.symbol} className="earned">
          <div className="stat-label">Earned while waiting · {e.symbol}</div>
          {e.status === 'ok' ? (
            <>
              <div className={`stat-figure ${BigInt(e.earnedUsdc) < 0n ? 'is-down' : 'is-up'}`}>
                {signedUsd(e.earnedUsdc)}
                {e.earnedBps !== null && <span className="earned-pct"> ({pct(e.earnedBps)})</span>}
              </div>
              <p className="earned-why">
                {subject} kept in {e.symbol} is worth <strong>{usd(e.keptUsdc)}</strong>: {tokenAmount(e.heldStock, e.decimals, e.symbol)} still held
                {BigInt(e.usdcFromSales) > 0n && <> + {usd(e.usdcFromSales)} already paid to agents</>}. Sold to idle USDC on {day(e.since)}, it would be{' '}
                <strong>{usd(e.idleUsdc)}</strong>.
              </p>
              <p className="stat-note">
                Chainlink {e.symbol.replace(/c$/, '')}: {price(e.startPrice, e.priceDecimals)} on {day(e.since)}
                {e.startSource === 'first_refill' ? ' (first refill)' : ' (permission signed)'} → {price(e.nowPrice, e.priceDecimals)} now ({ago(e.nowPriceAt)}). Stocks
                can go down too.
              </p>
            </>
          ) : (
            <div className="stat-figure">{e.status === 'no_start' ? 'starts with the first refill' : 'unavailable'}</div>
          )}
        </div>
      ))}
    </div>
  );
}
