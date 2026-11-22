import { useMemo } from 'react';
import type { Puzzle } from '../../core/puzzle/types.ts';
import { toPlayView } from '../../core/puzzle/views.ts';
import { KeyStrip } from '../puzzle/KeyStrip.tsx';
import { PuzzleGrid } from '../puzzle/PuzzleGrid.tsx';
import { PuzzlePage } from '../puzzle/PuzzlePage.tsx';
import styles from './EditorPanel.module.scss';

export interface EditorPanelProps {
  readonly puzzle: Puzzle;
}

const DIRECTION_LABEL = { across: 'по горизонтали', down: 'по вертикали' } as const;
const STATUS_LABEL = { passed: '✓', failed: '✗', skipped: '—' } as const;

export function EditorPanel({ puzzle }: EditorPanelProps) {
  const view = useMemo(() => toPlayView(puzzle), [puzzle]);
  const solution = useMemo(() => Object.fromEntries(puzzle.cipher.map((e) => [e.number, e.letter])), [puzzle]);
  const givenNumbers = useMemo(() => new Set(puzzle.givens), [puzzle]);
  const words = useMemo(
    () => [...puzzle.words].sort((a, b) => a.dir.localeCompare(b.dir) || a.row - b.row || a.col - b.col),
    [puzzle],
  );
  const report = puzzle.validation;

  return (
    <div className={styles.layout}>
      <PuzzlePage
        view={view}
        grid={<PuzzleGrid view={view} letters={solution} givenNumbers={givenNumbers} />}
        keyStrip={<KeyStrip entries={view.key} letters={solution} givenNumbers={givenNumbers} />}
      />

      <aside className={styles.side} aria-label="Редакторские данные">
        <section className={styles.section}>
          <h2>Ответ</h2>
          <p className={styles.answer}>{puzzle.answerParts.map((p) => p.text).join(' ')}</p>
          <p className={styles.muted}>
            {puzzle.answerParts
              .map((p) => `часть ${p.order}: строка ${p.row + 1}, столбец ${p.col + 1}, ${DIRECTION_LABEL[p.dir]}`)
              .join('; ')}
          </p>
          <p className={styles.muted}>
            Сложность: {puzzle.meta.difficulty}, seed {puzzle.meta.seed}, алфавит {puzzle.meta.alphabet}, сетка{' '}
            {puzzle.grid.width}×{puzzle.grid.height}
          </p>
        </section>

        <section className={styles.section}>
          <h2>Проверка {report?.valid ? <span className={styles.ok}>пройдена</span> : <span className={styles.bad}>не пройдена</span>}</h2>
          <ul className={styles.checks}>
            {report?.checks.map((check) => (
              <li key={check.id} className={styles[check.status]}>
                <span aria-hidden="true">{STATUS_LABEL[check.status]}</span> {check.title}
              </li>
            ))}
          </ul>
          {report && report.issues.length > 0 && (
            <ul className={styles.issues}>
              {report.issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2>Шифр</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">Буква</th>
                <th scope="col">Подсказка</th>
              </tr>
            </thead>
            <tbody>
              {puzzle.cipher.map((entry) => (
                <tr key={entry.number}>
                  <td>{entry.number}</td>
                  <td>{entry.letter}</td>
                  <td>{givenNumbers.has(entry.number) ? 'да' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h2>Слова ({words.length})</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Слово</th>
                <th scope="col">Строка</th>
                <th scope="col">Столбец</th>
                <th scope="col">Направление</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={`${w.dir}-${w.row}-${w.col}`}>
                  <td>{w.word}</td>
                  <td>{w.row + 1}</td>
                  <td>{w.col + 1}</td>
                  <td>{DIRECTION_LABEL[w.dir]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </aside>
    </div>
  );
}
