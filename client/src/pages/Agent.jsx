import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { usd } from '../format.js';
import AgentForm from '../components/AgentForm.jsx';

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

  if (agent === undefined) return <p className="text-body-secondary">Loading…</p>;
  if (agent === null) return <div className="alert alert-danger">{error} <Link to="/app">Back</Link></div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <Link to="/app" className="small">← Dashboard</Link>
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-2 mb-3">
        <h1 className="h3 mb-0">{agent.name}</h1>
        <button
          type="button"
          className={`btn ${agent.status === 'active' ? 'btn-outline-danger' : 'btn-success'}`}
          onClick={() => patch({ status: agent.status === 'active' ? 'paused' : 'active' }).catch((e) => setError(e.message))}
        >
          {agent.status === 'active' ? 'Pause agent' : 'Resume agent'}
        </button>
      </div>
      <dl className="row small">
        <dt className="col-4">Wallet</dt><dd className="col-8 font-monospace text-break">{agent.walletAddress}</dd>
        <dt className="col-4">Status</dt><dd className="col-8">{agent.status}</dd>
        <dt className="col-4">USDC float</dt><dd className="col-8">{usd(agent.usdcBalance)}</dd>
      </dl>
      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">Saved.</div>}
      <h2 className="h5">Limits</h2>
      <AgentForm key={agent.updatedAt ?? 'a'} initial={agent} submitLabel="Save" onSubmit={patch} />
    </div>
  );
}
