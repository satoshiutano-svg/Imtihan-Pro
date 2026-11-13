import { Hono } from 'hono';
import type { Env } from './types';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';

const app = new Hono<{ Bindings: Env }>();

// Security headers & lightweight per-IP rate limiting
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');

  const rawMax = Number(c.env.RATE_LIMIT_MAX_REQUESTS ?? '120');
  const rawWindow = Number(c.env.RATE_LIMIT_WINDOW_SEC ?? '60');
  const maxReq = Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : 120;
  const windowSec = Number.isFinite(rawWindow) && rawWindow > 0 ? Math.floor(rawWindow) : 60;
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

  if (ip !== 'unknown' && c.env.CATALOG_KV) {
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const rlKey = `rl:${ip}:${bucket}`;
    const parsedCurrent = Number((await c.env.CATALOG_KV.get(rlKey)) ?? '0');
    const current = Number.isFinite(parsedCurrent) && parsedCurrent >= 0 ? parsedCurrent : 0;
    if (current >= maxReq) {
      return c.json({ error: 'Rate limit exceeded. Try again shortly.' }, 429);
    }
    await c.env.CATALOG_KV.put(rlKey, String(current + 1), {
      expirationTtl: Math.max(60, windowSec + 5),
    });
  }

  await next();
});

app.route('/v1', publicRoutes);
app.route('/v1/admin', adminRoutes);

export default app;
