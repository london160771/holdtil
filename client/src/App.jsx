// Phase 0 app shell: banner and notices only. Screens come in Phase 2 and 5 (PRD §21).
const FLOW = 'FUND WITH STOCK → AGENT PAYS → FLOAT RUNS LOW → FAIR-PRICE REFILL → PRICE OFF? WAIT → OWNER STOPS IT ANYTIME';

export function Notices() {
  return (
    <p className="small text-body-secondary mb-0">
      Not for US persons. Not financial advice. Stocks can go down. Holdtil never holds your funds or keys.
    </p>
  );
}

export default function App() {
  return (
    <>
      <div className="real-banner text-center py-1">REAL · BASE MAINNET</div>
      <main className="container py-5" style={{ maxWidth: 720 }}>
        <h1 className="fw-bold">Holdtil</h1>
        <p className="lead">Your agent&apos;s money stays invested until it pays.</p>
        <p className="flow">
          <code>{FLOW}</code>
        </p>
        <div className="alert alert-secondary" role="status">
          In development. Sign-in opens when it works on Base mainnet.
        </div>
      </main>
      <footer className="container pb-4" style={{ maxWidth: 720 }}>
        <Notices />
      </footer>
    </>
  );
}
