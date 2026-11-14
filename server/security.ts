import type { NextFunction, Request, Response } from 'express';

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow same-origin framing so the integrated Books Library PDF viewer (<object>/<iframe>) renders inline
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

export function createRateLimiter(options: { maxRequests: number; windowMs: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (typeof req.headers['cf-connecting-ip'] === 'string' && req.headers['cf-connecting-ip']) ||
      req.ip ||
      'local';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = requestBuckets.get(key);

    if (!existing || existing.resetAt <= now) {
      requestBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      if (requestBuckets.size > 2000) {
        for (const [k, v] of requestBuckets.entries()) {
          if (v.resetAt <= now) requestBuckets.delete(k);
        }
      }
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Retry after ${retryAfterSec}s.`,
        retryAfterSec,
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
