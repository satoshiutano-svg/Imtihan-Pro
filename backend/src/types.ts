export interface Env {
  DB: D1Database;
  CONTENT_BUCKET: R2Bucket;
  CATALOG_KV: KVNamespace;
  ENVIRONMENT: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  ADMIN_API_TOKEN?: string;
  AGENT_API_TOKEN?: string;
  VERIFIER_API_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ARCHIVE_CHANNEL_ID?: string;
}
