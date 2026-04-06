import styles from './EmptyState.module.css';

interface Props {
  message: string;
  className?: string;
}

export default function EmptyState({ message, className }: Props) {
  return (
    <div className={`${styles.empty} ${className || ''}`}>{message}</div>
  );
}
