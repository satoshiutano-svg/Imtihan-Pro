import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';

export interface ShareCardPayload {
  kicker: string;
  title: string;
  lines: string[];
  highlightMetric?: string;
}

interface WhatsAppShareModalProps {
  card: ShareCardPayload | null;
  onClose: () => void;
}

export function formatWhatsAppShareText(card: ShareCardPayload): string {
  return [
    `*Roshan Study — ${card.kicker}*`,
    `*${card.title}*`,
    ...(card.highlightMetric ? [`Score / Key Result: ${card.highlightMetric}`] : []),
    '',
    ...card.lines,
    '',
    'Free offline KPK BISE Grades 9–12 & MDCAT practice.',
  ].join('\n');
}

export function WhatsAppShareModal({ card, onClose }: WhatsAppShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!card) return null;

  const shareText = formatWhatsAppShareText(card);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp Study Card Preview"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-[#171D1A]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              1-Tap WhatsApp Study Card
            </p>
            <h3 className="font-display mt-0.5 text-base font-bold text-neutral-900 dark:text-neutral-100">
              Share with Classmates
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Clean visual card preview */}
        <div className="mt-4 rounded-xl border border-neutral-200 bg-[#F7FAF8] p-4 dark:border-neutral-800 dark:bg-[#101412]">
          <div className="text-xs font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
            Roshan Study · {card.kicker}
          </div>
          <div className="mt-1 text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {card.title}
          </div>
          {card.highlightMetric && (
            <div className="font-mono-tabular mt-2 text-lg font-bold text-neutral-900 dark:text-white">
              {card.highlightMetric}
            </div>
          )}
          <div className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            {card.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#1E7E4E]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied Text' : 'Copy Text'}
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1B6B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155537]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Send on WhatsApp
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
