import { HoldGlyph } from './Brand.jsx';

const NY = 'America/New_York';
const nyTime = (d) => d.toLocaleString('en-US', { timeZone: NY, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const localTime = (d) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Explains price_stale waits (PRD §16 "Market hours"). Display only: the server's price guard still decides.
 * Shows nothing while the market is open or when the API did not send a status.
 */
export default function MarketNotice({ market }) {
  if (!market || market.open) return null;
  const why = market.reason === 'holiday' && market.holiday ? `closed for ${market.holiday}` : 'closed for the weekend';
  const next = market.nextOpenAt ? new Date(market.nextOpenAt) : null;
  return (
    <div className="alert alert-warning market-notice" role="status">
      <HoldGlyph size={12} />
      <div>
        <strong>US stock market {why}.</strong> Chainlink stock prices pause, so Holdtil waits instead of selling at an old price (you&apos;ll see
        &ldquo;Price too old, waited&rdquo;). Your stock stays in your wallet.
        {next && (
          <>
            {' '}Next refill window expected <strong>{nyTime(next)} New York time</strong> ({localTime(next)} your time).
          </>
        )}
      </div>
    </div>
  );
}
