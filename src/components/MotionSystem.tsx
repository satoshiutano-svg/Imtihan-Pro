import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export const ROSHAN_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const ROSHAN_FAST_DURATION = 0.16;
export const ROSHAN_TRANSITION_DURATION = 0.22;

interface MotionScreenSwapProps {
  motionKey: string;
  children: ReactNode;
  className?: string;
}

export function MotionScreenSwap({
  motionKey,
  children,
  className = '',
}: MotionScreenSwapProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={motionKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: ROSHAN_TRANSITION_DURATION, ease: ROSHAN_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface MotionRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function MotionReveal({
  children,
  delay = 0,
  className = '',
}: MotionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ROSHAN_TRANSITION_DURATION, delay, ease: ROSHAN_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface MotionCollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function MotionCollapse({ open, children, className = '' }: MotionCollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.96, originY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.96 }}
          transition={{ duration: ROSHAN_FAST_DURATION, ease: ROSHAN_EASE }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MotionQuizFeedbackProps {
  state: 'idle' | 'correct' | 'incorrect';
  children: ReactNode;
  className?: string;
}

export function MotionQuizFeedback({
  state,
  children,
  className = '',
}: MotionQuizFeedbackProps) {
  const animateProps =
    state === 'correct'
      ? { scale: [0.97, 1.015, 1], opacity: 1 }
      : state === 'incorrect'
        ? { x: [0, -6, 6, -4, 4, 0], opacity: 1 }
        : { scale: 1, x: 0, opacity: 1 };

  return (
    <motion.div
      animate={animateProps}
      transition={{ duration: 0.28, ease: ROSHAN_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface MotionProgressTrackProps {
  percent: number;
  className?: string;
  barClassName?: string;
}

export function MotionProgressTrack({
  percent,
  className = 'h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800',
  barClassName = 'h-full origin-left bg-[#1B6B46] dark:bg-[#6CD19B]',
}: MotionProgressTrackProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={barClassName}
        initial={false}
        animate={{ scaleX: clamped / 100 }}
        transition={{ duration: 0.26, ease: ROSHAN_EASE }}
        style={{ width: '100%' }}
      />
    </div>
  );
}

interface MotionModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function MotionModal({
  open,
  onClose,
  children,
  maxWidthClass = 'max-w-2xl',
}: MotionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ROSHAN_FAST_DURATION }}
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: ROSHAN_TRANSITION_DURATION, ease: ROSHAN_EASE }}
            className={`max-h-[90vh] w-full ${maxWidthClass} overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
