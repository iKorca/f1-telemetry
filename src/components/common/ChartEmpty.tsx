import React from 'react';

interface Props {
  title?: string;
  message: string;
  hint?: string;
  height?: number;
}

/**
 * Shared empty-state chart placeholder. Replaces silent `return null` across
 * every practice chart so the user sees why a chart vanished (missing data,
 * not-enough-laps, pin-a-ref, etc.) instead of an unexplained blank panel.
 */
export default function ChartEmpty({ title, message, hint, height = 120 }: Props) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        padding: '0.6rem',
        border: '1px dashed var(--border)',
        borderRadius: '6px',
        background: 'rgba(0, 0, 0, 0.08)',
        color: 'var(--grey)',
        fontFamily: 'var(--font-d)',
        fontSize: '0.55rem',
        textAlign: 'center',
        letterSpacing: '0.05em',
      }}
    >
      {title && (
        <div style={{ color: 'var(--grey-light)', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em' }}>
          {title}
        </div>
      )}
      <div>{message}</div>
      {hint && (
        <div style={{ fontSize: '0.48rem', fontStyle: 'italic', opacity: 0.7 }}>{hint}</div>
      )}
    </div>
  );
}
