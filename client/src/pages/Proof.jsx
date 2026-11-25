import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { usd, short } from '../format.js';

const tx = (h) => (
  <a href={`https://basescan.org/tx/${h}`} target="_blank" rel="noreferrer" className="small">
    {short(h)} on BaseScan
  </a>
);

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
  if (!data) return <p className="text-body-secondary">Loading…</p>;
  const { scout, totals, payments, refills } = data;

  return (
    <div>
      <h1 className="h3">Live proof</h1>
      <p className="text-body-secondary">
        Holdtil Scout is our own AI agent on Base mainnet. It pays for real market data over x402 in USDC. When its USDC runs low, Holdtil sells a small
        amount of stock at a fair price and tops it up. Every row below links to the real transaction.
      </p>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3"><div className="card card-body"><div className="small text-body-secondary">Scout wallet</div><div className="font-monospace small text-break">{scout ? <a href={`https://basescan.org/address/${scout.address}`} target="_blank" rel="noreferrer">{short(scout.address)}</a> : 'not set'}</div></div></div>
        <div className="col-6 col-md-3"><div className="card card-body"><div className="small text-body-secondary">USDC float now</div><div className="fs-5">{scout ? usd(scout.usdcBalance) : 'unavailable'}</div></div></div>
        <div className="col-6 col-md-3"><div className="card card-body"><div className="small text-body-secondary">x402 payments</div><div className="fs-5">{totals.payments}</div><div className="small text-body-secondary">{usd(totals.paidUsdc)} paid</div></div></div>
        <div className="col-6 col-md-3"><div className="card card-body"><div className="small text-body-secondary">Refills</div><div className="fs-5">{totals.refills}</div><div className="small text-body-secondary">{usd(totals.refilledUsdc)} topped up</div></div></div>
      </div>
      <p className="small text-body-secondary">Counts cover the {totals.window} records.</p>

      <h2 className="h5">Refills and decisions</h2>
      {refills.length === 0 ? (
        <p className="text-body-secondary">No refills yet.</p>
      ) : (
        <ul className="list-group mb-4">
          {refills.map((r, i) => (
            <li key={`${r.createdAt}-${i}`} className="list-group-item">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <span>
                  <span className={`badge me-2 ${r.state === 'confirmed' ? 'text-bg-success' : r.state === 'waited' ? 'text-bg-warning' : 'text-bg-secondary'}`}>{r.state}</span>
                  {r.code && <code className="small">{r.code}</code>}
                </span>
                <span className="small text-body-secondary">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="small text-body-secondary mt-1">
                {r.usdcOut && <>Topped up {usd(r.usdcOut)} · </>}
                {r.gapBps && <>Fair: {(Number(r.gapBps) / 100).toFixed(2)}% from reference · </>}
                {r.minOut && <>Min-out {usd(r.minOut)}</>}
              </div>
              {r.txHash && tx(r.txHash)}
            </li>
          ))}
        </ul>
      )}

      <h2 className="h5">Scout's x402 payments</h2>
      {payments.length === 0 ? (
        <p className="text-body-secondary">No payments yet.</p>
      ) : (
        <ul className="list-group">
          {payments.map((p, i) => (
            <li key={`${p.at}-${i}`} className="list-group-item">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <span>
                  <span className={`badge me-2 ${p.status === 'paid' ? 'text-bg-success' : 'text-bg-secondary'}`}>{p.status}</span>
                  {p.costUsdc && usd(p.costUsdc)}
                </span>
                <span className="small text-body-secondary">{new Date(p.at).toLocaleString()}</span>
              </div>
              {p.summary && <div className="small mt-1">{p.summary}</div>}
              {p.txHash && tx(p.txHash)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
