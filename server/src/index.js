import { createApp } from './app.js';
import { loadConfig, missingEnv } from './config/env.js';

const config = loadConfig();
const missing = missingEnv();
if (missing.length) {
  // Names only, never values.
  console.warn(`[startup] missing env vars: ${missing.join(', ')}`);
}

createApp().listen(config.port, () => {
  console.log(`[startup] Holdtil API listening on :${config.port}`);
});
