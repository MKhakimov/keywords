import type { ReactNode } from 'react';
import type { PlayView } from '../../core/puzzle/views.ts';
import { voidBox } from './gridGeometry.ts';
import styles from './PuzzlePage.module.scss';

export interface PuzzlePageProps {
  readonly view: PlayView;
  readonly grid: ReactNode;
  readonly keyStrip: ReactNode;
}

export function PuzzlePage({ view, grid, keyStrip }: PuzzlePageProps) {
  const { rubric, heading, riddle, explanation } = view.editorial;
  const box = voidBox(view);
  const textIndent = box && box.col === 0 ? `${(box.width / view.grid.width) * 100}%` : '0';

  return (
    <article className={styles.page} aria-label={heading || 'Кейворд'}>
      <header className={styles.header}>
        {rubric && <p className={styles.rubric}>{rubric}</p>}
        {heading && <h1 className={styles.heading}>{heading}</h1>}
      </header>
      {(riddle || explanation) && (
        <div className={styles.lead} style={{ marginLeft: textIndent }}>
          {riddle && <p className={styles.riddle}>{riddle}</p>}
          {explanation && <p className={styles.explanation}>{explanation}</p>}
        </div>
      )}
      <div className={styles.grid}>{grid}</div>
      <div className={styles.key}>{keyStrip}</div>
    </article>
  );
}
