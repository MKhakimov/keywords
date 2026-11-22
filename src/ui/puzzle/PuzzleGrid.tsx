import { useId, useMemo } from 'react';
import type { Direction } from '../../core/grid/types.ts';
import type { PlayView } from '../../core/puzzle/views.ts';
import { CELL, voidBox, wordCells } from './gridGeometry.ts';
import { KeyIcon } from './KeyIcon.tsx';
import styles from './PuzzleGrid.module.scss';

export interface PuzzleGridProps {
  readonly view: PlayView;
  readonly letters: Readonly<Record<number, string>>;
  readonly givenNumbers?: ReadonlySet<number>;
  readonly selected?: number | null;
  readonly direction?: Direction;
  readonly wrongNumbers?: ReadonlySet<number>;
  readonly noticeNumbers?: ReadonlySet<number>;
  readonly onCellClick?: (index: number) => void;
}

const EMPTY = new Set<number>();

export function PuzzleGrid({
  view,
  letters,
  givenNumbers = EMPTY,
  selected = null,
  direction = 'across',
  wrongNumbers = EMPTY,
  noticeNumbers = EMPTY,
  onCellClick,
}: PuzzleGridProps) {
  const clipId = useId();
  const { width, height, cells } = view.grid;
  const box = useMemo(() => voidBox(view), [view]);
  const activeWord = useMemo(
    () => new Set(selected === null ? [] : wordCells(view, selected, direction)),
    [view, selected, direction],
  );
  const selectedCell = selected === null ? undefined : cells[selected];
  const selectedNumber = selectedCell?.kind === 'letter' ? selectedCell.number : null;

  const keyMarkers = view.answerMarkers.map((marker) => ({
    order: marker.order,
    row: marker.dir === 'down' ? marker.row - 1 : marker.row,
    col: marker.dir === 'down' ? marker.col : marker.col - 1,
  }));

  return (
    <svg
      className={styles.grid}
      viewBox={`-2 -2 ${width * CELL + 4} ${height * CELL + 4}`}
      role="grid"
      aria-label={`Сетка кейворда ${width}×${height}`}
    >
      {box && view.illustration.src && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={box.col * CELL} y={box.row * CELL} width={box.width * CELL - 6} height={box.height * CELL - 6} />
            </clipPath>
          </defs>
          <image
            href={view.illustration.src}
            x={box.col * CELL}
            y={box.row * CELL}
            width={box.width * CELL - 6}
            height={box.height * CELL - 6}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          >
            <title>{view.illustration.alt}</title>
          </image>
        </>
      )}

      {cells.map((cell, index) => {
        const x = (index % width) * CELL;
        const y = Math.floor(index / width) * CELL;
        if (cell.kind === 'void') return null;
        if (cell.kind === 'block') {
          return <rect key={index} className={styles.block} x={x} y={y} width={CELL} height={CELL} />;
        }
        const letter = letters[cell.number];
        const classes = [styles.cell];
        if (cell.answerPart !== undefined) classes.push(styles.answer);
        if (selectedNumber === cell.number) classes.push(styles.sameNumber);
        if (activeWord.has(index)) classes.push(styles.word);
        if (selected === index) classes.push(styles.selected);
        if (wrongNumbers.has(cell.number)) classes.push(styles.wrong);
        if (noticeNumbers.has(cell.number)) classes.push(styles.notice);
        return (
          <g
            key={index}
            role="gridcell"
            aria-label={`Номер ${cell.number}${letter ? `, буква ${letter}` : ''}`}
            onClick={onCellClick ? () => onCellClick(index) : undefined}
            className={onCellClick ? styles.interactive : undefined}
          >
            <rect className={classes.join(' ')} x={x} y={y} width={CELL} height={CELL} />
            <text className={styles.number} x={x + 3} y={y + 11}>
              {cell.number}
            </text>
            {letter && (
              <text
                className={givenNumbers.has(cell.number) ? `${styles.letter} ${styles.given}` : styles.letter}
                x={x + CELL / 2}
                y={y + CELL / 2 + 9}
              >
                {letter}
              </text>
            )}
          </g>
        );
      })}

      {keyMarkers.map((marker) =>
        marker.row >= 0 && marker.col >= 0 ? (
          <KeyIcon key={marker.order} x={marker.col * CELL} y={marker.row * CELL} size={CELL} order={marker.order} />
        ) : null,
      )}
    </svg>
  );
}
