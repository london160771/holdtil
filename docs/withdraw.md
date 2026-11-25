# Withdraw everything (after submission)

Holdtil never holds your money. Everything sits in wallets you control. Do the steps in this order.

## 1. Stop Holdtil from selling
1. Dashboard → **Stop all**. The next tick sells nothing.
2. Render → service → Environment → set `EXECUTOR_MODE` empty. On cron-job.org, pause the tick job.
3. Dashboard → Spend permissions → **Revoke**. Your Base Account asks you to confirm and pays a tiny gas fee. After this the Spend Permission Manager refuses every spend, so no one can move your stock with that permission.
   - Check: the permission row shows `revoked`.

## 2. Your NVDAc
Your stock never left your Base Account (only what each refill sold). Nothing to do: it's yours. To sell it, use any Base app that swaps NVDAc (for example Aerodrome) from your own wallet.

## 3. Test Agent's USDC
The Test Agent wallet `0xbAbD…7589` is your own wallet. Open it in your wallet app and send the USDC wherever you want.

## 4. Scout's USDC
Scout's key is only in your `scout/.env` (and the GitHub secret).
1. GitHub → repo → Settings → Secrets and variables → Actions → **Variables**: set `SCOUT_MODE` empty, so Scout stops paying. You can also delete the `SCOUT_PRIVATE_KEY` secret.
2. In `scout/.env` add `SWEEP_TO=` your own address (public, not a secret).
3. Scout pays gas for the transfer itself, so send Scout ~$0.01 of ETH on Base first.
4. Dry run: `npm run scout:sweep`. It shows Scout's USDC and ETH and simulates the transfer.
5. Send: `npm run scout:sweep -- --send`. It prints the tx hash.
   - Check: open the hash on basescan.org; Scout's USDC balance is 0.

## 5. The spender's leftover gas ETH
The spender holds a little ETH for gas, never user money. Its keys are in CDP.
1. Make sure step 1 is done (no ticks running).
2. Put the CDP keys of the spender's project in `server/.env` (dev spender) or `server/.env.prod` (prod spender), plus `BASE_RPC_URL`, `SPENDER_ADDRESS` and `SWEEP_TO=` your address.
3. Dry run: `npm run spender -- sweep` (or `npm run spender:prod -- sweep`). It shows how much would be sent and keeps a tiny amount for the transfer's own gas.
4. Send: `npm run spender -- sweep --send` (or `spender:prod`). It prints the tx hash.
   - Check: open the hash on basescan.org.

## 6. Shut down (optional)
- Render: suspend the service. Vercel: pause or delete the project. cron-job.org: delete both jobs.
- Atlas: keep the data if you want the history, or delete the cluster.
- CDP: delete the API keys you no longer use.
