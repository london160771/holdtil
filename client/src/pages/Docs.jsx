import { Link } from 'react-router-dom';

const Code = ({ children }) => (
  <pre className="bg-body-tertiary border rounded p-3 small mb-3" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
    <code>{children}</code>
  </pre>
);

/** Connect guide (PRD §21 screen 5): how to point any agent wallet at Holdtil. Zero integration. */
export default function Docs() {
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="h3">Connect your agent</h1>
      <p className="lead">
        Holdtil needs no code in your agent. Your agent keeps paying from its own wallet like it does today. Holdtil watches that wallet&apos;s USDC and
        tops it up from your stock when it runs low.
      </p>

      <h2 className="h5 mt-4">What you need</h2>
      <ul>
        <li>A Base Account that holds tokenized stock (today: NVDAc).</li>
        <li>Your agent&apos;s wallet address on Base. It must pay its bills in Base USDC, for example x402 payments.</li>
        <li>The agent wallet must be separate from your own account.</li>
      </ul>

      <h2 className="h5 mt-4">Steps</h2>
      <ol className="list-group list-group-numbered mb-3">
        <li className="list-group-item">
          <strong>Sign in with Base</strong> and confirm you are not a US person.
        </li>
        <li className="list-group-item">
          <strong>Add your agent.</strong> Paste its wallet address and set limits: when to refill (floor), how high to fill (target), the most per refill, and
          the most per day. The address can never be changed later. USDC only ever goes there.
        </li>
        <li className="list-group-item">
          <strong>Grant a Spend Permission</strong> from your Base Account. It lets Holdtil move at most a set amount of stock per day. You can revoke it any
          time from your wallet or the dashboard.
        </li>
        <li className="list-group-item">
          <strong>Done.</strong> Every few minutes Holdtil checks your agent&apos;s USDC. Below the floor, it sells a small amount of stock and sends the USDC
          straight to the agent wallet.
        </li>
      </ol>

      <h2 className="h5 mt-4">When Holdtil sells, and when it waits</h2>
      <ul>
        <li>The Chainlink reference price must be fresh. Stock markets close at weekends, so refills wait until the price updates.</li>
        <li>The swap price must be close to the reference price. If it is off, Holdtil waits.</li>
        <li>Every sale stays inside your agent limits, your daily limit, and the permission allowance.</li>
        <li>Each sale is simulated first and has a minimum USDC out. If anything fails, nothing is sent.</li>
        <li>Each decision is shown on the agent page, with the reason and the BaseScan link.</li>
      </ul>

      <h2 className="h5 mt-4">Example: an x402 agent</h2>
      <p>Any agent that pays with x402 from its own key works as is. Point Holdtil at the address of the key it pays from.</p>
      <Code>{`// Your agent's existing x402 client (this is how Holdtil Scout pays).
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(account) }],
});
const res = await paidFetch('https://example.com/paid-api');

// Nothing else changes. Add account.address as an agent in Holdtil.`}</Code>
      <p className="small text-body-secondary">
        Holdtil Scout, our own agent, works exactly like this. See it on the <Link to="/proof">live proof page</Link>.
      </p>

      <h2 className="h5 mt-4">Stop it any time</h2>
      <ul>
        <li>Pause one agent, or press Stop on the dashboard to stop every agent.</li>
        <li>Revoke the Spend Permission and Holdtil can no longer move any stock.</li>
      </ul>

      <h2 className="h5 mt-4">Risks</h2>
      <p className="mb-0">
        Stocks can go down, so your agent&apos;s budget can shrink. Tokenized stocks are not available to US persons. This is not financial advice. Holdtil
        never holds your funds or keys.
      </p>
    </div>
  );
}
