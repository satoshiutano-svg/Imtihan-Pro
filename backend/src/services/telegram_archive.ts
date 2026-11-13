import type { Env } from '../types';

export interface ArchiveResult {
  archived: boolean;
  messageId?: string;
  reason?: string;
}

/**
 * Backend-only cold archival to a private Telegram channel.
 *
 * Security & budget rule:
 * - Mobile clients NEVER receive Telegram credentials or talk to Telegram.
 * - Used strictly for disaster-recovery copies of published JSON packs or
 *   permitted assets, never as primary CDN serving infrastructure.
 */
export async function archiveJsonPackToTelegram(
  env: Env,
  fileName: string,
  jsonContent: string,
  caption: string,
): Promise<ArchiveResult> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ARCHIVE_CHANNEL_ID) {
    return {
      archived: false,
      reason: 'Telegram archive credentials not configured in Worker secrets.',
    };
  }

  try {
    const form = new FormData();
    form.append('chat_id', env.TELEGRAM_ARCHIVE_CHANNEL_ID);
    form.append('caption', caption.slice(0, 1000));
    form.append(
      'document',
      new Blob([jsonContent], { type: 'application/json' }),
      fileName,
    );

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`,
      {
        method: 'POST',
        body: form,
      },
    );

    if (!response.ok) {
      return {
        archived: false,
        reason: `Telegram API HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
    };

    return {
      archived: Boolean(payload.ok),
      messageId: payload.result?.message_id?.toString(),
    };
  } catch (err) {
    return {
      archived: false,
      reason: err instanceof Error ? err.message : 'Unknown archive error',
    };
  }
}
