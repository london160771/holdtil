import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithBase } from '../wallet.js';

const FLOW = ['Fund with stock', 'Agent pays', 'Float runs low', 'Fair-price refill', 'Price off? Wait', 'Owner stops it anytime'];

export default function Landing({ onSignedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithBase();
      await onSignedIn();
      navigate('/start');
    } catch (e) {
      setError(e.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="fw-bold display-6">Your agent&apos;s money stays invested until it pays.</h1>
      <p className="lead mt-3">
        Keep your AI agent&apos;s budget in tokenized stocks on Base. When the agent&apos;s USDC runs low, Holdtil sells a small amount of stock and tops it up,
        but only at a fair price and only inside your limits.
      </p>
      <button type="button" className="btn btn-primary btn-lg mt-2" onClick={signIn} disabled={busy}>
        {busy ? 'Waiting for your wallet…' : 'Sign in with Base'}
      </button>
      {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}

      <h2 className="h5 mt-5">How it works</h2>
      <ol className="list-group list-group-numbered mb-4">
        {FLOW.map((s) => (
          <li key={s} className="list-group-item">{s}</li>
        ))}
      </ol>

      <h2 className="h5">The rules</h2>
      <ul>
        <li>Sells only when the Chainlink reference price is fresh and the swap price is close to it. Otherwise it waits.</li>
        <li>Never sells more than the limits you set, and only through a Spend Permission you sign and can revoke.</li>
        <li>USDC only ever goes to the agent wallet you registered.</li>
        <li>One tap stops every agent.</li>
      </ul>

      <h2 className="h5">Risks</h2>
      <p className="mb-0">
        Stocks can go down. Tokenized stocks are not available to US persons. This is not financial advice. Holdtil never holds your funds or keys.
      </p>
    </div>
  );
}
