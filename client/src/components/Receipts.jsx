import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { usd } from '../format.js';

const BADGE = { confirmed: 'text-bg-success', failed: 'text-bg-danger', blocked: 'text-bg-danger', waited: 'text-bg-warning', sent: 'text-bg-info' };

/** Receipts and decisions for one agent (GET /v1/refills). Every value comes from the DB; tx links go to BaseScan. */
export default function Receipts({ agentId }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api(`/v1/refills?agentId=${encodeURIComponent(agentId)}`)
      .then((r) => setList(r.refills))
      .catch((e) => setError(e.message));
  }, [agentId]);

  if (error) return <div className="alert alert-danger">Could not load refills: {error}</div>;
  if (list === null) return <p className="text-body-secondary">Loading…</p>;
  if (list.length === 0) return <p className="text-body-secondary">No refills or decisions yet.</p>;
  return (
    <ul className="list-group">
      {list.map((r) => (
        <li key={r.refillId} className="list-group-item">
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <span>
              <span className={`badge me-2 ${BADGE[r.state] ?? 'text-bg-secondary'}`}>{r.state}</span>
              {r.code && <code className="small">{r.code}</code>}
            </span>
            <span className="small text-body-secondary">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          {r.reason && <div className="small mt-1">{r.reason}</div>}
          <div className="small text-body-secondary mt-1">
            {r.usdcOut && <>Sent to agent: {usd(r.usdcOut)} · </>}
            {!r.usdcOut && r.simulatedUsdcOut && <>Simulated: {usd(r.simulatedUsdcOut)} · </>}
            {r.minOut && <>Min-out: {usd(r.minOut)} · </>}
            {r.gapBps && <>Gap: {r.gapBps} bps</>}
          </div>
          {r.txHash && (
            <a className="small text-break" href={`https://basescan.org/tx/${r.txHash}`} target="_blank" rel="noreferrer">
              View on BaseScan
            </a>
          )}
          {r.code && r.nextAction && r.state !== 'confirmed' && <div className="small text-body-secondary">Next: {r.nextAction}</div>}
        </li>
      ))}
    </ul>
  );
}
