import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from './components/Brand.jsx';
import { api } from './api.js';
import { short } from './format.js';
import Landing from './pages/Landing.jsx';
import Start from './pages/Start.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Agent from './pages/Agent.jsx';
import Proof from './pages/Proof.jsx';
import Docs from './pages/Docs.jsx';

export function Notices() {
  return (
    <p className="notices">
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
    <header className="site-header">
      <nav className="wrap site-nav" aria-label="Main">
        <Link to={me?.user ? '/app' : '/'} className="text-decoration-none" aria-label="Holdtil home">
          <Logo />
        </Link>
        <div className="site-links">
          {me?.user && <NavLink to="/app" end className="nav-a">Dashboard</NavLink>}
          <NavLink to="/docs" className="nav-a">Docs</NavLink>
          <NavLink to="/proof" className="nav-a">Live proof</NavLink>
          {me?.user && (
            <>
              <span className="addr d-none d-md-inline">{short(me.user.address)}</span>
              <button type="button" className="btn btn-sm btn-quiet" onClick={onSignOut}>
                Sign out
              </button>
            </>
          )}
        </div>
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
    if (me === undefined) return <p className="text-secondary">Loading…</p>;
    if (me?.error) return <div className="alert alert-danger">Could not load your account: {me.error}</div>;
    if (!me) return <Navigate to="/" replace />;
    return el;
  };

  return (
    <>
      <div className="real-banner">
        <span className="live-dot" aria-hidden="true" />
        REAL · BASE MAINNET
      </div>
      <Header me={me} onSignOut={signOut} />
      <main className="wrap site-main">
        <Routes>
          <Route path="/" element={me?.user ? <Navigate to={me.user.onboarded ? '/app' : '/start'} replace /> : <Landing onSignedIn={reload} />} />
          <Route path="/start" element={gate(<Start me={me} reload={reload} />)} />
          <Route path="/app" element={gate(me?.user?.onboarded === false ? <Navigate to="/start" replace /> : <Dashboard me={me} reload={reload} />)} />
          <Route path="/app/agents/:id" element={gate(<Agent />)} />
          <Route path="/proof" element={<Proof />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<p className="empty">Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
      <footer className="wrap site-footer">
        <Notices />
        <p className="credit">
          Stock ticker photo: Edison Universal Stock Printer, Smithsonian National Museum of American History, public domain, via{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Thomas_Edison_stock_ticker_NMAH-JN2014-3625.jpg" target="_blank" rel="noreferrer">Wikimedia Commons</a>.
        </p>
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
