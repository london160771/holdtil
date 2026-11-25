import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Tape, TapeRow } from './Tape.jsx';

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
  if (list === null) return <p className="text-secondary">Loading…</p>;
  if (list.length === 0) return <p className="empty">No refills or decisions yet. The first one prints here.</p>;
  return (
    <Tape>
      {list.map((r) => (
        <TapeRow key={r.refillId} r={r} />
      ))}
    </Tape>
  );
}
