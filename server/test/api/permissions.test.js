import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startDb, makeApp, newUser, signIn, signedPermission } from './helpers.js';
import { ADDRESSES } from '../../src/config/addresses.js';
import { permissionHash } from '../../src/chain/spendPermission.js';

let env;
let app;
let chain;
beforeAll(async () => {
  env = await startDb();
  ({ app, chain } = makeApp(env.db));
});
afterAll(() => env?.stop());

describe('spend permissions (FR-PRM-001/002)', () => {
  it('stores a permission signed by the signed-in account and shows remaining allowance', async () => {
    const me = newUser();
    const a = await signIn(app, me);
    const body = await signedPermission(me);
    const res = await a.post('/v1/permissions').send(body);
    expect(res.status).toBe(201);
    expect(res.body.permission).toMatchObject({ symbol: 'NVDAc', allowance: '2000000', status: 'signed' });
    const list = await a.get('/v1/permissions');
    expect(list.body.permissions[0]).toMatchObject({ status: 'active', remaining: '2000000' });
  });

  it('accepts the Base Account SDK shape: hex salt, 365-day end', async () => {
    const me = newUser();
    const a = await signIn(app, me);
    const saltHex = '0x' + 'ab'.repeat(32);
    const now = Math.floor(Date.now() / 1000);
    const body = await signedPermission(me, { salt: BigInt(saltHex), start: now, end: now + 365 * 86_400 });
    body.permission.salt = saltHex;
    const res = await a.post('/v1/permissions').send(body);
    expect(res.status).toBe(201);
    expect(res.body.permission.salt).toBe(BigInt(saltHex).toString());
  });

  it('rejects a salt that is not a number', async () => {
    const me = newUser();
    const a = await signIn(app, me);
    const body = await signedPermission(me);
    body.permission.salt = '0xzz';
    const res = await a.post('/v1/permissions').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('permission_invalid');
  });

  it('needs onboarding first', async () => {
    const me = newUser();
    const a = await signIn(app, me, { onboard: false });
    const res = await a.post('/v1/permissions').send(await signedPermission(me));
    expect(res.body.error.code).toBe('onboarding_required');
  });

  it.each([
    ['another account', async () => signedPermission(newUser())],
    ['wrong spender', async (me) => signedPermission(me, { spender: newUser().address })],
    ['unsupported token', async (me) => signedPermission(me, { token: ADDRESSES.USDC })],
    ['zero allowance', async (me) => signedPermission(me, { allowance: 0n })],
    ['expired', async (me) => signedPermission(me, { start: 1000, end: 2000 })],
    ['period too short', async (me) => signedPermission(me, { period: 60 })],
    ['signature for other fields', async (me) => {
      const b = await signedPermission(me);
      return { ...b, permission: { ...b.permission, allowance: '999999999' } };
    }],
    ['signed by another key', async (me) => {
      const b = await signedPermission(me);
      const other = await signedPermission(newUser(), { account: me.address });
      return { ...b, signature: other.signature };
    }],
    ['missing signature', async (me) => ({ ...(await signedPermission(me)), signature: undefined })],
  ])('rejects %s with permission_invalid', async (_n, make) => {
    const me = newUser();
    const a = await signIn(app, me);
    const res = await a.post('/v1/permissions').send(await make(me));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('permission_invalid');
  });

  it('same permission twice is rejected', async () => {
    const me = newUser();
    const a = await signIn(app, me);
    const body = await signedPermission(me);
    expect((await a.post('/v1/permissions').send(body)).status).toBe(201);
    expect((await a.post('/v1/permissions').send(body)).status).toBe(400);
  });

  it('revoked on chain shows as revoked; chain down shows unavailable', async () => {
    const me = newUser();
    const a = await signIn(app, me);
    const body = await signedPermission(me);
    await a.post('/v1/permissions').send(body);
    const p = { ...body.permission, allowance: BigInt(body.permission.allowance), salt: BigInt(body.permission.salt) };
    chain.state.revoked.add(permissionHash(p));
    expect((await a.get('/v1/permissions')).body.permissions[0].status).toBe('revoked');
    chain.state.fail = true;
    const down = await a.get('/v1/permissions');
    chain.state.fail = false;
    expect(down.body.permissions[0]).toMatchObject({ status: 'unavailable', remaining: 'unavailable' });
  });

  it("users only see their own permissions", async () => {
    const me = newUser();
    const a = await signIn(app, me);
    await a.post('/v1/permissions').send(await signedPermission(me));
    const b = await signIn(app, newUser());
    expect((await b.get('/v1/permissions')).body.permissions).toHaveLength(0);
  });
});
