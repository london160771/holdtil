import { Link } from 'react-router-dom';

const Code = ({ children }) => (
  <pre>
    <code>{children}</code>
  </pre>
);

const WORDS = [
  ['AI agent', 'A program that does tasks for you and can pay for what it uses, like data or tools.'],
  ['Wallet', 'An account on the internet that holds money. You hold its key; nobody else can move the money.'],
  ['USDC', 'A digital dollar. 1 USDC is worth about $1. Agents pay their bills with it.'],
  ['Tokenized stock (NVDAc)', 'A token on Base that tracks a real share, here NVIDIA. It goes up and down like the stock.'],
  ['Base', 'A low-cost network run by Coinbase where these wallets, tokens and payments live.'],
  ['Base Account', 'Your Coinbase smart wallet on Base. You sign in with it; no password.'],
  ['Spend Permission', 'A limit you sign in your Base Account: "Holdtil may use up to X of my stock per day." You can cancel it any time.'],
  ['x402', 'A way for agents to pay for a web request with USDC, one small payment at a time.'],
];

/** Docs (PRD §21 screen 5): the product in plain words, how to use it, and how to connect an agent. */
export default function Docs() {
  return (
    <div className="docs page">
      <h1 className="page-title">How Holdtil works</h1>
      <p className="page-lead">
        Your AI agent needs a little cash to pay its bills. Holdtil lets you keep the rest of its budget invested in stock, and sells a small piece
        only when the agent runs low, only at a fair price, and only within limits you set.
      </p>

      <div className="callout">
        <strong>In one picture</strong>
        <p className="mb-0 mt-1">
          Think of a prepaid card for your agent and a savings account in stock. When the card balance gets low, Holdtil moves a little money from
          savings to the card. If the stock price looks wrong right now, it waits instead.
        </p>
      </div>

      <h2>The words you&apos;ll see</h2>
      <dl className="words">
        {WORDS.map(([w, d]) => (
          <div key={w}>
            <dt>{w}</dt>
            <dd className="mb-0">{d}</dd>
          </div>
        ))}
      </dl>

      <h2>What happens, step by step</h2>
      <ol>
        <li><strong>You fund with stock.</strong> Your Base Account holds NVDAc. It stays yours, in your wallet.</li>
        <li><strong>Your agent pays.</strong> It pays for data or tools in USDC from its own wallet, like it already does.</li>
        <li><strong>The float runs low.</strong> Every few minutes Holdtil checks the agent&apos;s USDC. Below your floor, a refill is due.</li>
        <li><strong>Fair-price refill.</strong> Holdtil sells a small amount of your stock and sends the USDC straight to the agent wallet, in one transaction.</li>
        <li><strong>Price off? Wait.</strong> If the price is old or the market price is far from the real price, it does nothing and tries later.</li>
        <li><strong>You stop it anytime.</strong> One tap stops every agent. Revoking the permission stops it for good.</li>
      </ol>

      <h2>How to use it</h2>
      <ol className="howto">
        <li>
          <strong>Sign in with Base.</strong> Use your Base Account (Coinbase smart wallet). Confirm you are not a US person.
        </li>
        <li>
          <strong>Add your agent.</strong> Give it a name and paste its wallet address. Set limits or keep the safe defaults: refill when it has under
          $1, fill it up to $3, at most $2 per refill and $5 a day. The address can never be changed later. USDC only ever goes there.
        </li>
        <li>
          <strong>Sign a Spend Permission.</strong> Choose how much stock Holdtil may use per day. Your wallet shows exactly what you sign.
        </li>
        <li>
          <strong>That&apos;s it.</strong> Your agent page lists every refill and every wait, with the reason and a link to the transaction on BaseScan.
        </li>
      </ol>

      <h2>When Holdtil sells, and when it waits</h2>
      <ul>
        <li>The reference price (Chainlink) must be recent. Stock markets close at weekends, so refills wait until they reopen.</li>
        <li>The price on the exchange must be within 1% of the reference price.</li>
        <li>The refill must fit your agent limits, your daily limit and the permission.</li>
        <li>Every sale is tested first and has a minimum amount of USDC it must return. If anything fails, nothing is sent.</li>
      </ul>

      <h2>Stop it any time</h2>
      <ul>
        <li><strong>Pause</strong> one agent from its page.</li>
        <li><strong>Stop all</strong> on the dashboard stops every agent at once.</li>
        <li><strong>Revoke</strong> the permission on the dashboard (or in your wallet). After that nobody can use it to move your stock.</li>
      </ul>

      <h2>For developers: connect any agent</h2>
      <p>No SDK and no code change. Any agent that pays from its own key on Base works as is. Add that key&apos;s address as an agent in Holdtil.</p>
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
      <p className="text-secondary">
        Holdtil Scout, our own agent, works exactly like this. See its real payments and refills on the <Link to="/proof">live proof page</Link>.
      </p>

      <h2>Questions</h2>
      <dl className="faq">
        <dt>Does Holdtil hold my money?</dt>
        <dd>No. Your stock stays in your Base Account and the USDC goes to your agent&apos;s wallet. Holdtil only uses the permission you signed.</dd>
        <dt>What does it cost?</dt>
        <dd>Holdtil pays the network fee for refills. The swap has a small exchange fee, included in the price check.</dd>
        <dt>Can I get everything out?</dt>
        <dd>Yes. Revoke the permission; your stock is already in your wallet, and the agent&apos;s USDC is in the agent&apos;s wallet.</dd>
      </dl>

      <h2>Risks</h2>
      <p className="mb-0">
        Stocks can go down, so your agent&apos;s budget can shrink. Tokenized stocks are not available to US persons. This is not financial advice. Holdtil
        never holds your funds or keys.
      </p>
    </div>
  );
}
