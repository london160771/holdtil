import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { usd, tokenAmount, short } from '../format.js';
import GrantPermission from '../components/GrantPermission.jsx';
import AgentForm from '../components/AgentForm.jsx';
import { revokePermission } from '../wallet.js';
import { Plus, Play, OctagonX } from 'lucide-react';
import { HoldGlyph } from '../components/Brand.jsx';

function FloatBar({ agent }) {
  if (agent.usdcBalance === undefined || agent.usdcBalance === 'unavailable') {
    return <div className="float-top"><span>USDC float</span><span>unavailable</span></div>;
  }
  const bal = BigInt(agent.usdcBalance);
  const target = BigInt(agent.targetUsdc);
  const floor = BigInt(agent.floorUsdc);
  const pct = target > 0n ? Number((bal * 100n) / target) : 0;
  const floorPct = target > 0n ? Number((floor * 100n) / target) : 0;
  const low = bal < floor;
  return (
    <div>
      <div className="float-top">
        <span>USDC float</span>
        <span className="float-figure">{usd(agent.usdcBalance)}</span>
      </div>
      <div className="float-track" role="progressbar" aria-label="USDC float" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`float-fill ${low ? 'is-low' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        {floorPct > 0 && floorPct < 100 && <div className="float-floor" style={{ left: `${floorPct}%` }} title="Refill floor" />}
      </div>
      <div className="float-scale">
        <span>floor {usd(agent.floorUsdc)}</span>
        <span>target {usd(agent.targetUsdc)}</span>
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
      <div className="page-head">
        <h1 className="page-title">Dashboard</h1>
        <button type="button" className={`btn ${me.user.stopped ? 'btn-success' : 'btn-danger'}`} onClick={toggleStop}>
          {me.user.stopped ? <Play size={16} strokeWidth={1.5} aria-hidden="true" /> : <OctagonX size={16} strokeWidth={1.5} aria-hidden="true" />}
          {me.user.stopped ? 'Resume all' : 'Stop all'}
        </button>
      </div>
      {me.user.stopped && (
        <div className="alert alert-warning stop-banner">
          <HoldGlyph size={12} />
          All agents are stopped. Holdtil will not sell anything until you resume.
        </div>
      )}
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

      <div className="stats stats-3">
        <div className="stat"><div className="stat-label">Agents</div><div className="stat-figure">{me.totals.agents}</div></div>
        <div className="stat stat-key"><div className="stat-label">Refilled today</div><div className="stat-figure">{usd(me.totals.spentTodayUsdc)}</div><div className="stat-note">of {usd(me.user.dailyLimitUsdc)} daily limit</div></div>
        <div className="stat"><div className="stat-label">Account</div><div className="stat-figure is-mono">{short(me.user.address)}</div><div className="stat-note">{me.user.stopped ? 'Stopped' : 'Running'}</div></div>
      </div>

      <div className="block-head">
        <h2 className="block-title">Agents</h2>
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : <><Plus size={16} strokeWidth={1.5} aria-hidden="true" /> Add agent</>}
        </button>
      </div>
      {showAdd && (
        <div className="panel mb-3">
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
        <p className="text-secondary">{loadFailed ? 'Agents unavailable.' : 'Loading…'}</p>
      ) : agents.length === 0 ? (
        <p className="empty">No agents yet. Add the wallet your agent pays from.</p>
      ) : (
        <div className="agent-list">
          {agents.map((a) => (
            <Link key={a.id} to={`/app/agents/${a.id}`} className="agent-card">
              <div className="agent-card-head">
                <span className="agent-name">{a.name}</span>
                <span className={`chip ${a.status === 'active' ? 'chip-ok' : 'chip-muted'}`}>
                  {a.status === 'active' ? <span className="chip-dot" /> : <HoldGlyph size={10} />}
                  {a.status}
                </span>
              </div>
              <div className="agent-wallet">{short(a.walletAddress)}</div>
              <FloatBar agent={a} />
            </Link>
          ))}
        </div>
      )}

      <div className="block-head">
        <h2 className="block-title">Spend permissions</h2>
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => setShowGrant((v) => !v)}>
          {showGrant ? 'Cancel' : <><Plus size={16} strokeWidth={1.5} aria-hidden="true" /> New permission</>}
        </button>
      </div>
      {showGrant && (
        <div className="panel mb-3">
          <GrantPermission me={me} onDone={async () => { setShowGrant(false); await load(); }} />
        </div>
      )}
      {perms === null ? (
        <p className="text-secondary">{loadFailed ? 'Permissions unavailable.' : 'Loading…'}</p>
      ) : perms.length === 0 ? (
        <p className="empty">No permission yet. Holdtil cannot refill anything until you sign one.</p>
      ) : (
        <div className="table-wrap table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Stock</th><th>Per day</th><th>Left today</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {perms.map((p) => {
                const d = DECIMALS(me, p.symbol);
                return (
                  <tr key={p.permissionHash}>
                    <td className="fw-medium">{p.symbol}</td>
                    <td className="font-monospace">{d === undefined ? 'unavailable' : tokenAmount(p.allowance, d, '')}</td>
                    <td className="font-monospace">{d === undefined ? 'unavailable' : tokenAmount(p.remaining, d, '')}</td>
                    <td><span className={`chip ${p.status === 'active' ? 'chip-ok' : 'chip-muted'}`}><span className="chip-dot" />{p.status}</span></td>
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
