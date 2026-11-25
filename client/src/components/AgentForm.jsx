import { useState } from 'react';
import { usdToUnits, unitsToUsdInput } from '../format.js';

const FIELDS = [
  ['floorUsdc', 'Refill when USDC is below ($)'],
  ['targetUsdc', 'Refill up to ($)'],
  ['maxPerRefillUsdc', 'Max per refill ($)'],
  ['dailyLimitUsdc', 'Daily limit for this agent ($)'],
];

/** Add or edit an agent. initial = agent from the API (money as base-unit strings) or null for a new one. */
export default function AgentForm({ initial, onSubmit, submitLabel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [wallet, setWallet] = useState('');
  const [money, setMoney] = useState(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, initial?.[k] ? unitsToUsdInput(initial[k]) : ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim() };
      if (!initial) body.walletAddress = wallet.trim();
      for (const [k] of FIELDS) if (money[k] !== '') body[k] = usdToUnits(money[k]);
      await onSubmit(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="vstack gap-3">
      <div>
        <label className="form-label" htmlFor="agent-name">Agent name</label>
        <input id="agent-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </div>
      {!initial && (
        <div>
          <label className="form-label" htmlFor="agent-wallet">Agent wallet address (where USDC is sent)</label>
          <input id="agent-wallet" className="form-control font-monospace" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" required />
          <div className="form-text">This cannot be changed later. Holdtil only ever sends USDC here.</div>
        </div>
      )}
      <div className="row g-3 align-items-end">
        {FIELDS.map(([k, label]) => (
          <div className="col-6 col-md-3" key={k}>
            <label className="form-label small" htmlFor={k}>{label}</label>
            <input
              id={k}
              className="form-control"
              inputMode="decimal"
              value={money[k]}
              placeholder={initial ? '' : 'default'}
              onChange={(e) => setMoney({ ...money, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {!initial && <div className="form-text mt-0">Leave limits empty to use small safe defaults ($1 floor, $3 target, $2 per refill, $5 a day).</div>}
      {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
      <div>
        <button className="btn btn-ink" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
