import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'drs' | 'drsAvailable' | 'drsActive' | 'pit' | 'flagYellow' | 'flagRed' | 'flagSc' | 'on' | 'default';

interface BadgeProps {
  text: string;
  active?: boolean;
  variant?: BadgeVariant;
  className?: string;
}

function Badge({ text, active = false, variant = 'default', className }: BadgeProps) {
  const variantClass = active ? getVariantClass(variant) : '';
  return (
    <span className={`${styles.badge} ${variantClass} ${className || ''}`}>
      {text}
    </span>
  );
}

function getVariantClass(variant: BadgeVariant): string {
  switch (variant) {
    case 'on':           return styles.bOn;
    case 'pit':          return styles.bPit;
    case 'flagYellow':   return styles.bFlagY;
    case 'flagRed':      return styles.bFlagR;
    case 'flagSc':       return styles.bFlagSc;
    case 'drsAvailable': return styles.bDrsAvailable;
    case 'drsActive':    return styles.bDrsActive;
    case 'drs':          return styles.bOn;
    default:             return '';
  }
}

export default React.memo(Badge);
