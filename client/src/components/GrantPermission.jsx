import { useState } from 'react';
import { parseUnits } from 'viem';
import { grantPermission } from '../wallet.js';

/** Signs a daily Spend Permission for one stock. Signing only — nothing is spent. */
export default function GrantPermission({ me, onDone, defaultSymbol }) {
  const stocks = me?.chain?.stocks ?? [];
  const [symbol, setSymbol] = useState(stocks.some((s) => s.symbol === defaultSymbol) ? defaultSymbol : (stocks[0]?.symbol ?? ''));
  const [amount, setAmount] = useState('0.01');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const stock = stocks.find((s) => s.symbol === symbol);
  const spender = me?.chain?.spenderAddress;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!stock || !spender) return setError('Holdtil is not set up for permissions yet (spender unavailable).');
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) return setError('Enter an amount like 0.01');
    let allowance;
    try {
      allowance = parseUnits(amount.trim(), stock.decimals);
    } catch {
      return setError('Too many decimal places');
    }
    if (allowance <= 0n) return setError('Amount must be above 0');
    setBusy(true);
    try {
      await grantPermission({ account: me.user.address, spender, token: stock.address, allowance: allowance.toString() });
      await onDone?.();
    } catch (err) {
      setError(err.message || 'The wallet did not sign');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="vstack gap-3">
      <p className="mb-0">
        This lets Holdtil sell up to this much stock per day from your Base Account, only to refill your agents. You can revoke it any time in your wallet.
        Signing does not move any money.
      </p>
      <div className="row g-3">
        <div className="col-6 col-md-3">
          <label className="form-label small" htmlFor="perm-stock">Stock</label>
          <select id="perm-stock" className="form-select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {stocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>{s.name ? `${s.symbol} · ${s.name}` : s.symbol}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small" htmlFor="perm-amount">Max per day ({symbol})</label>
          <input id="perm-amount" className="form-control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
      <div>
        <button className="btn btn-ink" disabled={busy}>{busy ? 'Waiting for your wallet…' : 'Sign spend permission'}</button>
      </div>
    </form>
  );
}
