import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { short } from './format.js';
import Landing from './pages/Landing.jsx';
import Start from './pages/Start.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Agent from './pages/Agent.jsx';

export function Notices() {
  return (
    <p className="small text-body-secondary mb-0">
      Not for US persons. Not financial advice. Stocks can go down. Holdtil never holds your funds or keys.
    </p>
  );
}

/** Loads the signed-in user. me === undefined while loading, null when signed out. */
function useMe() {
  const [me, setMe] = useState(undefined);
  const reload = useCallback(async () => {
    try {
      setMe(await api('/v1/me'));
    } catch (e) {
      if (e.status === 401) setMe(null);
      else setMe({ error: e.message });
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return [me, reload];
}

function Header({ me, onSignOut }) {
  return (
    <header className="border-bottom">
      <nav className="container d-flex align-items-center justify-content-between py-2" style={{ maxWidth: 960 }}>
        <Link to={me?.user ? '/app' : '/'} className="fw-bold text-decoration-none text-body fs-5">
          Holdtil
        </Link>
        {me?.user && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-body-secondary d-none d-sm-inline">{short(me.user.address)}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}

function Shell() {
  const [me, reload] = useMe();
  const navigate = useNavigate();
  const signOut = async () => {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => {});
    await reload();
    navigate('/');
  };

  const gate = (el) => {
    if (me === undefined) return <p className="text-body-secondary">Loading…</p>;
    if (me?.error) return <div className="alert alert-danger">Could not load your account: {me.error}</div>;
    if (!me) return <Navigate to="/" replace />;
    return el;
  };

  return (
    <>
      <div className="real-banner text-center py-1">REAL · BASE MAINNET</div>
      <Header me={me} onSignOut={signOut} />
      <main className="container py-4" style={{ maxWidth: 960 }}>
        <Routes>
          <Route path="/" element={me?.user ? <Navigate to={me.user.onboarded ? '/app' : '/start'} replace /> : <Landing onSignedIn={reload} />} />
          <Route path="/start" element={gate(<Start me={me} reload={reload} />)} />
          <Route path="/app" element={gate(me?.user?.onboarded === false ? <Navigate to="/start" replace /> : <Dashboard me={me} reload={reload} />)} />
          <Route path="/app/agents/:id" element={gate(<Agent />)} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
      <footer className="container pb-4" style={{ maxWidth: 960 }}>
        <hr />
        <Notices />
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
