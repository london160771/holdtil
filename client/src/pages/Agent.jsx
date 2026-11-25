import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { usd } from '../format.js';
import AgentForm from '../components/AgentForm.jsx';
import Receipts from '../components/Receipts.jsx';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { StateChip } from '../components/Tape.jsx';

export default function Agent() {
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
      <dl className="facts">
        <dt>Wallet</dt><dd className="font-monospace text-break">{agent.walletAddress}</dd>
        <dt>Status</dt><dd><StateChip state={agent.status === 'active' ? 'confirmed' : 'waited'} label={agent.status} /></dd>
        <dt>USDC float</dt><dd className="tnum">{usd(agent.usdcBalance)}</dd>
      </dl>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {saved && <div className="alert alert-success mt-3">Saved</div>}
      <div className="block-head"><h2 className="block-title">Limits</h2></div>
      <div className="panel">
        <AgentForm key={agent.updatedAt ?? 'a'} initial={agent} submitLabel="Save" onSubmit={patch} />
      </div>
      <div className="block-head"><h2 className="block-title">Refills and decisions</h2></div>
      <Receipts agentId={agent.id} />
    </div>
  );
}
