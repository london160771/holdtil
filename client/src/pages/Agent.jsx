import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { usd } from '../format.js';
import AgentForm from '../components/AgentForm.jsx';
import Receipts from '../components/Receipts.jsx';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { StateChip } from '../components/Tape.jsx';
import MarketNotice from '../components/MarketNotice.jsx';
import SpendLog from '../components/SpendLog.jsx';

/** Spending log: x402 payments are known only for Holdtil Scout (it records what it bought). Other agents get a BaseScan link. */
function Spending({ agent }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let live = true;
    Promise.all([api('/v1/proof'), api(`/v1/refills?agentId=${agent.id}`)])
      .then(([proof, mine]) => {
        if (!live) return;
        const isScout = proof.scout && proof.scout.address.toLowerCase() === agent.walletAddress.toLowerCase();
        setData(isScout ? { payments: proof.payments, refills: mine.refills } : null);
      })
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [agent.id, agent.walletAddress]);
  if (data === undefined) return <p className="text-secondary">Loading…</p>;
  if (data === null) {
    return (
      <p className="stat-note">
        Holdtil sees refills, not what this agent buys. Every USDC payment from its wallet is on{' '}
        <a href={`https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913?a=${agent.walletAddress}`} target="_blank" rel="noreferrer">BaseScan</a>.
      </p>
    );
  }
  return <SpendLog refills={data.refills} payments={data.payments} />;
}

export default function Agent({ me }) {
  const { id } = useParams();
  const [agent, setAgent] = useState(undefined);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setAgent((await api(`/v1/agents/${id}`)).agent);
    } catch (e) {
      setAgent(null);
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body) => {
    setSaved(false);
    const { agent: a } = await api(`/v1/agents/${id}`, { method: 'PATCH', body });
    setAgent((prev) => ({ ...prev, ...a }));
    setSaved(true);
  };

  if (agent === undefined) return <p className="text-secondary">Loading…</p>;
  if (agent === null) return <div className="alert alert-danger">{error} <Link to="/app">Back</Link></div>;

  return (
    <div className="page">
      <Link to="/app" className="back"><ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Dashboard</Link>
      <div className="page-head mt-3">
        <h1 className="page-title">{agent.name}</h1>
        <button
          type="button"
          className={`btn ${agent.status === 'active' ? 'btn-outline-danger' : 'btn-success'}`}
          onClick={() => patch({ status: agent.status === 'active' ? 'paused' : 'active' }).catch((e) => setError(e.message))}
        >
          {agent.status === 'active' ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : <Play size={16} strokeWidth={1.5} aria-hidden="true" />}
          {agent.status === 'active' ? 'Pause agent' : 'Resume agent'}
        </button>
      </div>
      <MarketNotice market={me?.market} />
      <dl className="facts">
        <dt>Wallet</dt><dd className="font-monospace text-break">{agent.walletAddress}</dd>
        <dt>Status</dt><dd><StateChip state={agent.status === 'active' ? 'confirmed' : 'waited'} label={agent.status} /></dd>
        <dt>Pays from</dt><dd>{agent.stock}</dd>
        <dt>USDC float</dt><dd className="tnum">{usd(agent.usdcBalance)}</dd>
      </dl>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {saved && <div className="alert alert-success mt-3">Saved</div>}
      <div className="block-head"><h2 className="block-title">Limits</h2></div>
      <div className="panel">
        <AgentForm key={agent.updatedAt ?? 'a'} initial={agent} stocks={me?.chain?.stocks} submitLabel="Save" onSubmit={patch} />
      </div>
      <div className="block-head"><h2 className="block-title">Where the budget went</h2></div>
      <Spending agent={agent} />
      <div className="block-head"><h2 className="block-title">Refills and decisions</h2></div>
      <Receipts agentId={agent.id} />
    </div>
  );
}
