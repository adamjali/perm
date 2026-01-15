'use client';

import { motion } from 'motion/react';

/**
 * TypingIndicator Component
 *
 * Displays animated bouncing dots to indicate the AI is processing/typing.
 * Uses neobrutalist styling with hard shadows and borders.
 */
export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-1 px-4 py-3 bg-muted border-2 border-border shadow-hard-sm max-w-[100px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ delay: 0.4, duration: 0.15 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-muted-foreground rounded-full"
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: 0.4 + i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </motion.div>
  );
}
