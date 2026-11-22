import type { KeyEntry } from '../../core/puzzle/views.ts';
import styles from './KeyStrip.module.scss';

export interface KeyStripProps {
  readonly entries: readonly KeyEntry[];
  readonly letters: Readonly<Record<number, string>>;
  readonly givenNumbers: ReadonlySet<number>;
  readonly wrongNumbers?: ReadonlySet<number>;
  readonly noticeNumbers?: ReadonlySet<number>;
  readonly selectedNumber?: number | null;
}

const EMPTY = new Set<number>();

export function KeyStrip({
  entries,
  letters,
  givenNumbers,
  wrongNumbers = EMPTY,
  noticeNumbers = EMPTY,
  selectedNumber = null,
}: KeyStripProps) {
  return (
    <ol className={styles.strip} aria-label="Ключ: номер и буква">
      {entries.map(({ number }) => {
        const classes = [styles.item];
        if (selectedNumber === number) classes.push(styles.selected);
        if (wrongNumbers.has(number)) classes.push(styles.wrong);
        if (noticeNumbers.has(number)) classes.push(styles.notice);
        const letter = letters[number];
        return (
          <li key={number} className={classes.join(' ')}>
            <span className={styles.number}>{number}</span>
            <span className={givenNumbers.has(number) ? `${styles.letter} ${styles.given}` : styles.letter}>
              {letter ?? ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
