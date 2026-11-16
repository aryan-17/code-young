import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { SystemClock } from './lib/clock.js';
import { FixedClock } from './lib/clock.js';

const config = loadConfig();

const clock = config.NOW_OVERRIDE
  ? new FixedClock(config.NOW_OVERRIDE)
  : new SystemClock();

const app = buildApp({ clock });

app.listen({ port: config.PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
