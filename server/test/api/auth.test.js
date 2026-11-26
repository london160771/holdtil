import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startDb, makeApp, newUser, siweFor, signIn } from './helpers.js';

let env;
let app;
beforeAll(async () => {
  env = await startDb();
  ({ app } = makeApp(env.db));
});
afterAll(() => env?.stop());

describe('Sign in with Base (FR-AUTH-001)', () => {
  it('valid signature → session cookie (httpOnly, SameSite=Lax) and /v1/me works', async () => {
    const acct = newUser();
    const agent = request.agent(app);
    const res = await agent.post('/v1/auth/verify').send(await siweFor(app, acct));
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/holdtil_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const me = await agent.get('/v1/me');
    expect(me.status).toBe(200);
    expect(me.body.user.address).toBe(acct.address.toLowerCase());
    expect(me.body.user.onboarded).toBe(false);
    expect(typeof me.body.market.open).toBe('boolean');
  });

  it('replayed nonce → auth_failed', async () => {
    const acct = newUser();
    const payload = await siweFor(app, acct);
    expect((await request(app).post('/v1/auth/verify').send(payload)).status).toBe(200);
    const again = await request(app).post('/v1/auth/verify').send(payload);
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe('auth_failed');
  });

  it('tampered message → auth_failed', async () => {
    const acct = newUser();
    const payload = await siweFor(app, acct);
    const res = await request(app).post('/v1/auth/verify').send({ ...payload, message: payload.message.replace('Sign in to Holdtil', 'Sign in to Holdtil!') });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth_failed');
  });

  it('signature from another key → auth_failed', async () => {
    const acct = newUser();
    const other = newUser();
    const payload = await siweFor(app, acct);
    const res = await request(app).post('/v1/auth/verify').send({ ...payload, signature: await other.signMessage({ message: payload.message }) });
    expect(res.body.error.code).toBe('auth_failed');
  });

  it.each([
    ['wrong domain', { domain: 'evil.example' }],
    ['wrong chain', { chainId: 1 }],
    ['wrong uri', { uri: 'https://evil.example' }],
    ['made-up nonce', { nonce: 'abcdefgh12345678' }],
    ['expired', { expirationTime: new Date(Date.now() - 1000) }],
  ])('%s → auth_failed', async (_n, patch) => {
    const res = await request(app).post('/v1/auth/verify').send(await siweFor(app, newUser(), patch));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth_failed');
  });

  it('body address must match the message', async () => {
    const payload = await siweFor(app, newUser());
    const res = await request(app).post('/v1/auth/verify').send({ ...payload, address: newUser().address });
    expect(res.body.error.code).toBe('auth_failed');
  });

  it('no cookie → 401; logout kills the session', async () => {
    expect((await request(app).get('/v1/me')).status).toBe(401);
    const agent = await signIn(app, newUser(), { onboard: false });
    expect((await agent.post('/v1/auth/logout')).status).toBe(200);
    expect((await agent.get('/v1/me')).status).toBe(401);
  });

  it('forged cookie → 401', async () => {
    const res = await request(app).get('/v1/me').set('Cookie', 'holdtil_session=not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('onboarding (FR-AUTH-002) and Stop (FR-CTL-001)', () => {
  it('needs both not-US and terms', async () => {
    const agent = await signIn(app, newUser(), { onboard: false });
    expect((await agent.post('/v1/me/onboard').send({ notUs: true })).status).toBe(400);
    expect((await agent.post('/v1/me/onboard').send({ notUs: 'yes', terms: true })).status).toBe(400);
    const ok = await agent.post('/v1/me/onboard').send({ notUs: true, terms: true });
    expect(ok.body.user.onboarded).toBe(true);
  });

  it('stop and resume', async () => {
    const agent = await signIn(app, newUser());
    expect((await agent.post('/v1/me/stop')).body.user.stopped).toBe(true);
    expect((await agent.post('/v1/me/resume')).body.user.stopped).toBe(false);
  });

  it('bad JSON → structured error', async () => {
    const res = await request(app).post('/v1/auth/verify').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });
});
