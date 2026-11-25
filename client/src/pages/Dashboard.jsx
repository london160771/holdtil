import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { usd, tokenAmount, short } from '../format.js';
import GrantPermission from '../components/GrantPermission.jsx';
import AgentForm from '../components/AgentForm.jsx';
import { revokePermission } from '../wallet.js';

function FloatBar({ agent }) {
  if (agent.usdcBalance === undefined || agent.usdcBalance === 'unavailable') {
    return <div className="small text-body-secondary">USDC float: unavailable</div>;
  }
  const bal = BigInt(agent.usdcBalance);
  const target = BigInt(agent.targetUsdc);
  const pct = target > 0n ? Number((bal * 100n) / target) : 0;
  const low = bal < BigInt(agent.floorUsdc);
  return (
    <div>
      <div className="d-flex justify-content-between small">
        <span>USDC float {usd(agent.usdcBalance)}</span>
        <span className="text-body-secondary">floor {usd(agent.floorUsdc)} · target {usd(agent.targetUsdc)}</span>
      </div>
      <div className="progress mt-1" role="progressbar" aria-label="USDC float" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} style={{ height: 8 }}>
        <div className={`progress-bar ${low ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

const DECIMALS = (me, symbol) => me.chain.stocks.find((s) => s.symbol === symbol)?.decimals;

export default function Dashboard({ me, reload }) {
  const [agents, setAgents] = useState(null);
  const [perms, setPerms] = useState(null);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api('/v1/agents'), api('/v1/permissions')]);
      setAgents(a.agents);
      setPerms(p.permissions);
      setLoadFailed(false);
      setError(null);
    } catch (e) {
      setError(e.message);
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const [revoking, setRevoking] = useState(null);
  const revoke = async (p) => {
    setError(null);
    setRevoking(p.permissionHash);
    try {
      await revokePermission(p);
      await load();
    } catch (e) {
      setError(e.message || 'The wallet did not revoke');
    } finally {
      setRevoking(null);
    }
  };

  const toggleStop = async () => {
    setError(null);
    try {
      await api(me.user.stopped ? '/v1/me/resume' : '/v1/me/stop', { method: 'POST' });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Dashboard</h1>
        <button type="button" className={`btn ${me.user.stopped ? 'btn-success' : 'btn-danger'}`} onClick={toggleStop}>
          {me.user.stopped ? 'Resume all' : 'Stop all'}
        </button>
      </div>
      {me.user.stopped && <div className="alert alert-warning">All agents are stopped. Holdtil will not sell anything until you resume.</div>}
      {error && (
        <div className="alert alert-danger d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <span>{error}</span>
          {loadFailed && (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={load}>
              Try again
            </button>
          )}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4"><div className="card card-body"><div className="small text-body-secondary">Agents</div><div className="fs-4">{me.totals.agents}</div></div></div>
        <div className="col-6 col-md-4"><div className="card card-body"><div className="small text-body-secondary">Refilled today</div><div className="fs-4">{usd(me.totals.spentTodayUsdc)}</div><div className="small text-body-secondary">limit {usd(me.user.dailyLimitUsdc)}</div></div></div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Agents</h2>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : 'Add agent'}</button>
      </div>
      {showAdd && (
        <div className="card card-body mb-3">
          <AgentForm
            submitLabel="Add agent"
            onSubmit={async (body) => {
              await api('/v1/agents', { method: 'POST', body });
              setShowAdd(false);
              await Promise.all([load(), reload()]);
            }}
          />
        </div>
      )}
      {agents === null ? (
        <p className="text-body-secondary">{loadFailed ? 'Agents unavailable.' : 'Loading…'}</p>
      ) : agents.length === 0 ? (
        <p className="text-body-secondary">No agents yet.</p>
      ) : (
        <div className="vstack gap-2 mb-4">
          {agents.map((a) => (
            <Link key={a.id} to={`/app/agents/${a.id}`} className="card card-body text-decoration-none text-body">
              <div className="d-flex justify-content-between mb-2">
                <strong>{a.name}</strong>
                <span className={`badge ${a.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'}`}>{a.status}</span>
              </div>
              <div className="small text-body-secondary font-monospace mb-2">{short(a.walletAddress)}</div>
              <FloatBar agent={a} />
            </Link>
          ))}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Spend permissions</h2>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowGrant((v) => !v)}>{showGrant ? 'Cancel' : 'New permission'}</button>
      </div>
      {showGrant && (
        <div className="card card-body mb-3">
          <GrantPermission me={me} onDone={async () => { setShowGrant(false); await load(); }} />
        </div>
      )}
      {perms === null ? (
        <p className="text-body-secondary">{loadFailed ? 'Permissions unavailable.' : 'Loading…'}</p>
      ) : perms.length === 0 ? (
        <p className="text-body-secondary">No permission yet. Holdtil cannot refill anything until you sign one.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr><th>Stock</th><th>Per day</th><th>Left today</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {perms.map((p) => {
                const d = DECIMALS(me, p.symbol);
                return (
                  <tr key={p.permissionHash}>
                    <td>{p.symbol}</td>
                    <td>{d === undefined ? 'unavailable' : tokenAmount(p.allowance, d, '')}</td>
                    <td>{d === undefined ? 'unavailable' : tokenAmount(p.remaining, d, '')}</td>
                    <td>{p.status}</td>
                    <td className="text-end">
                      {p.status === 'active' && (
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={revoking === p.permissionHash} onClick={() => revoke(p)}>
                          {revoking === p.permissionHash ? 'Waiting…' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
