import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import AgentForm from '../components/AgentForm.jsx';
import GrantPermission from '../components/GrantPermission.jsx';
import { Check } from 'lucide-react';

function Step({ n, title, done, active, children }) {
  return (
    <li className={`step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`} aria-current={active ? 'step' : undefined}>
      <h2 className="step-head">
        <span className="step-n">{done ? <Check size={16} strokeWidth={2} aria-label="Done" /> : String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      {active && <div className="step-body">{children}</div>}
    </li>
  );
}

export default function Start({ me, reload }) {
  const navigate = useNavigate();
  const [notUs, setNotUs] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState(null);
  const onboarded = me.user.onboarded;
  const hasAgent = me.totals.agents > 0;
  const [skipAgent, setSkipAgent] = useState(false);
  const step = !onboarded ? 1 : !hasAgent && !skipAgent ? 2 : 3;

  const onboard = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/v1/me/onboard', { method: 'POST', body: { notUs, terms } });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Get started</h1>
      <p className="page-lead">Three steps. Holdtil cannot sell anything until you sign a spend permission, and you can stop it any time.</p>
      <ol className="steps">
      <Step n={1} title="Confirm who you are" done={onboarded} active={step === 1}>
        <form onSubmit={onboard} className="vstack gap-2">
          <div className="form-check">
            <input id="not-us" type="checkbox" className="form-check-input" checked={notUs} onChange={(e) => setNotUs(e.target.checked)} />
            <label htmlFor="not-us" className="form-check-label">I am not a US person.</label>
          </div>
          <div className="form-check">
            <input id="terms" type="checkbox" className="form-check-input" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <label htmlFor="terms" className="form-check-label">I understand this is not financial advice, stocks can go down, and Holdtil sells my stock only inside the limits I set.</label>
          </div>
          {error && <div className="alert alert-danger mb-0">{error}</div>}
          <div><button className="btn btn-ink mt-2" disabled={!notUs || !terms}>Continue</button></div>
        </form>
      </Step>
      <Step n={2} title="Add your agent" done={hasAgent} active={step === 2}>
        <AgentForm
          submitLabel="Add agent"
          onSubmit={async (body) => {
            await api('/v1/agents', { method: 'POST', body });
            await reload();
          }}
        />
        <button type="button" className="btn btn-link px-0 mt-2" onClick={() => setSkipAgent(true)}>Skip for now</button>
      </Step>
      <Step n={3} title="Sign a spend permission" done={false} active={step === 3}>
        <GrantPermission me={me} onDone={() => navigate('/app')} />
        <button type="button" className="btn btn-link px-0 mt-2" onClick={() => navigate('/app')}>Skip for now</button>
      </Step>
      </ol>
    </div>
  );
}
