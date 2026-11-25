import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Wallet, Bot, BatteryLow, Scale, Hourglass, Power, Clock, ShieldCheck, Send, OctagonX } from 'lucide-react';
import { signInWithBase } from '../wallet.js';
import { api } from '../api.js';
import { usd } from '../format.js';
import { HoldGlyph } from '../components/Brand.jsx';
import { stateOf } from '../components/Tape.jsx';
import { useReveal } from '../reveal.js';

const FLOW = [
  [Wallet, 'Fund with stock', 'Your Base Account holds the stock. It stays yours, in your wallet.'],
  [Bot, 'Agent pays', 'Your agent pays for data and tools in USDC from its own wallet.'],
  [BatteryLow, 'Float runs low', 'Holdtil checks the agent every few minutes. Below your floor, a refill is due.'],
  [Scale, 'Fair-price refill', 'It sells a small piece of stock and sends USDC straight to the agent, in one transaction.'],
  [Hourglass, 'Price off? Wait', 'If the price is old or off, it does nothing and tries again later.'],
  [Power, 'Owner stops it anytime', 'One tap stops every agent. Revoking the permission stops it for good.'],
];

const RULES = [
  [Clock, 'Fresh, fair price or no sale', 'Sells only when the Chainlink reference price is fresh and the swap price is close to it. Otherwise it waits.'],
  [ShieldCheck, 'Your limits, your signature', 'Never sells more than the limits you set, and only through a Spend Permission you sign and can revoke.'],
  [Send, 'One destination', 'USDC only ever goes to the agent wallet you registered.'],
  [OctagonX, 'One tap stops it', 'Stop all, pause one agent, or revoke the permission. The next check sees it and sells nothing.'],
];

// Shown only when the live proof has no decisions to print. Clearly labelled, no hashes, no dates.
const EXAMPLE = [
  { state: 'confirmed', text: 'Sold a little NVDAc, gap inside 1%', amount: '+ USDC to agent' },
  { state: 'waited', text: 'Price gap above 1%', amount: 'waited' },
  { state: 'waited', text: 'Weekend, reference price stale', amount: 'waited' },
];

const WHY = { price_stale: 'Reference price stale', price_gap_too_wide: 'Price gap too wide', limit_exceeded: 'Limit reached', paused: 'Paused' };

/** The hero's paper tape. Prints Holdtil Scout's latest real decisions from GET /v1/proof. */
function HeroTape() {
  const [rows, setRows] = useState(undefined);
  useEffect(() => {
    api('/v1/proof')
      .then((d) => setRows((d.refills ?? []).slice(0, 3)))
      .catch(() => setRows([]));
  }, []);
  if (rows === undefined) return <div className="hero-tape is-loading" aria-hidden="true" />;
  const live = rows.length > 0;
  const lines = live
    ? rows.map((r) => ({
        state: r.state,
        text: r.usdcOut ? `Refilled Holdtil Scout${r.gapBps ? `, gap ${(Number(r.gapBps) / 100).toFixed(2)}%` : ''}` : WHY[r.code] ?? r.code ?? r.state,
        amount: r.usdcOut ? `+${usd(r.usdcOut)}` : stateOf(r.state).label.toLowerCase(),
      }))
    : EXAMPLE;
  return (
    <div className="hero-tape" aria-label={live ? 'Latest real decisions by Holdtil Scout' : 'Example decisions'}>
      <div className="hero-tape-head">
        <span>{live ? 'Live · Holdtil Scout' : 'Example'}</span>
        {live && <Link to="/proof">All proof</Link>}
      </div>
      <ol className="hero-tape-lines">
        {lines.map((l, i) => (
          <li key={i} className={`tl tl-${stateOf(l.state).tone}`} style={{ '--i': i }}>
            <span className="tl-mark">{stateOf(l.state).tone === 'wait' ? <HoldGlyph size={10} /> : <span className="chip-dot" />}</span>
            <span className="tl-text">{l.text}</span>
            <span className="tl-amt">{l.amount}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The fair-price gate drawn as a scale: a quote inside the band sells, outside it waits. */
function PriceGate() {
  const ref = useReveal();
  return (
    <figure ref={ref} className="gate reveal" aria-label="A quote outside the 1% band waits. A quote inside it sells.">
      <div className="gate-head">
        <span>The fair-price gate</span>
        <span className="gate-legend">band ±1% of reference</span>
      </div>
      <div className="gate-track">
        <div className="gate-band" />
        <div className="gate-ref"><span>reference</span></div>
        <div className="gate-rail"><div className="gate-quote"><span>quote</span></div></div>
      </div>
      <div className="gate-result">
        <span className="gate-wait"><HoldGlyph size={10} /> Outside the band: wait</span>
        <span className="gate-sell"><span className="chip-dot" /> Inside the band: sell</span>
      </div>
    </figure>
  );
}

export default function Landing({ onSignedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const flowRef = useReveal();
  const rulesRef = useReveal();

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
    <div className="landing">
      <section className="hero">
        <div className="hero-copy enter">
          <h1 className="hero-title">Your agent&apos;s budget should be working, even when it&apos;s not spending.</h1>
          <p className="hero-sub">
            Keep your AI agent&apos;s budget in tokenized stocks like NVDAc, right in your own Base wallet. Holdtil converts only what the agent needs into
            USDC, at a fair price and within the limits you&apos;ve approved. If the price isn&apos;t right, it waits.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-ink btn-lg" onClick={signIn} disabled={busy}>
              {busy ? 'Waiting for your wallet…' : 'Sign in with Base'}
            </button>
            <Link to="/proof" className="btn btn-quiet btn-lg">
              See it live <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
          <p className="hero-meta">Base mainnet · Chainlink reference price · Spend Permissions you can revoke</p>
        </div>
        <div className="hero-visual enter" style={{ '--d': '120ms' }}>
          <img
            className="hero-img"
            src="/img/stock-ticker.webp"
            srcSet="/img/stock-ticker-sm.webp 560w, /img/stock-ticker.webp 1100w"
            sizes="(max-width: 768px) 80vw, 480px"
            width="1100"
            height="1361"
            fetchPriority="high"
            alt="A brass stock ticker under a glass dome, printing paper tape"
          />
          <HeroTape />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">How it works</h2>
          <p className="section-sub">
            Agents pay for data, tools and APIs in small USDC payments over x402, so their owners keep USDC sitting idle in agent wallets. Holdtil changes that.
          </p>
        </div>
        <ol ref={flowRef} className="flow reveal">
          {FLOW.map(([Icon, title, text], i) => (
            <li key={title} className={`flow-step ${i === 4 ? 'is-wait' : ''}`} style={{ '--i': i }}>
              <div className="flow-top">
                <span className="flow-n">{String(i + 1).padStart(2, '0')}</span>
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="flow-title">{title}</h3>
              <p className="flow-text">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section rules-section">
        <PriceGate />
        <div>
          <h2 className="section-title">The rules</h2>
          <ul ref={rulesRef} className="rules reveal">
            {RULES.map(([Icon, title, text], i) => (
              <li key={title} className="rule" style={{ '--i': i }}>
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <h3 className="rule-title">{title}</h3>
                  <p className="rule-text">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section closing">
        <p className="closing-line">Your agent gets the liquidity it needs. Your capital gets the chance to keep working.</p>
      </section>

      <section className="section risks">
        <h2 className="section-title">Risks</h2>
        <p className="mb-0">
          Stocks can go down. Tokenized stocks are not available to US persons. This is not financial advice. Holdtil never holds your funds or keys.
        </p>
      </section>
    </div>
  );
}
