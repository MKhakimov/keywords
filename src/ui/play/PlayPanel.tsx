import type { KeyboardEvent } from 'react';
import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react';
import { RU_ALPHABET } from '../../core/alphabet.ts';
import type { PlayView } from '../../core/puzzle/views.ts';
import type { CheckResult, GameNotice } from '../game/gameState.ts';
import { createGameReducer, givenEntries, initialGameState } from '../game/gameState.ts';
import { KeyStrip } from '../puzzle/KeyStrip.tsx';
import { PuzzleGrid } from '../puzzle/PuzzleGrid.tsx';
import { PuzzlePage } from '../puzzle/PuzzlePage.tsx';
import styles from './PlayPanel.module.scss';

export interface PlayPanelProps {
  readonly view: PlayView;
  readonly initialProgress?: Readonly<Record<number, string>>;
  readonly initialSolved?: boolean;
  readonly onCheck: (entries: Readonly<Record<number, string>>) => CheckResult;
  readonly onProgress?: (entries: Readonly<Record<number, string>>, solved: boolean) => void;
}

function noticeText(notice: GameNotice): string {
  switch (notice.kind) {
    case 'given-letter':
      return `Буква «${notice.letter}» уже открыта под номером ${notice.number}: у разных номеров не может быть одинаковых букв.`;
    case 'given-cell':
      return `Номер ${notice.number} — стартовая буква «${notice.letter}», её нельзя изменить.`;
    case 'moved':
      return `Буква «${notice.letter}» перенесена с номера ${notice.from} на номер ${notice.to}: одна буква — один номер.`;
  }
}

function noticeNumber(notice: GameNotice): number {
  return notice.kind === 'moved' ? notice.from : notice.number;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export function PlayPanel({ view, initialProgress, initialSolved = false, onCheck, onProgress }: PlayPanelProps) {
  const reducer = useMemo(() => createGameReducer(view, RU_ALPHABET), [view]);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialGameState(view, initialProgress, initialSolved),
  );
  const skipFirstSave = useRef(true);
  const saveProgress = useEffectEvent((entries: Readonly<Record<number, string>>, solved: boolean) => {
    onProgress?.(entries, solved);
  });

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    saveProgress(state.entries, state.solved);
  }, [state.entries, state.solved]);
  const inputRef = useRef<HTMLInputElement>(null);
  const givenNumbers = useMemo(() => new Set(Object.keys(givenEntries(view)).map(Number)), [view]);
  const wrongNumbers = useMemo(() => new Set(state.check?.wrong ?? []), [state.check]);
  const noticeNumbers = useMemo(() => new Set(state.notice ? [noticeNumber(state.notice)] : []), [state.notice]);
  const selectedCell = state.selected === null ? undefined : view.grid.cells[state.selected];
  const selectedNumber = selectedCell?.kind === 'letter' ? selectedCell.number : null;

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });

  const handleCellClick = (index: number) => {
    dispatch({ type: 'select', index });
    focusInput();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      dispatch({ type: 'move', dRow: arrow[0], dCol: arrow[1] });
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      dispatch({ type: 'erase' });
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      dispatch({ type: 'input', letter: event.key });
    }
  };

  const handleInput = (value: string) => {
    for (const char of value) dispatch({ type: 'input', letter: char });
    if (inputRef.current) inputRef.current.value = '';
  };

  const check = state.check;
  const filled = Object.keys(state.entries).length;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'checked', result: onCheck(state.entries) })}>
          Проверить
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Стереть все вписанные буквы?')) dispatch({ type: 'reset' });
          }}
        >
          Начать заново
        </button>
        <span className={styles.progress}>
          Открыто букв: {filled} из {view.key.length}
        </span>
        <p className={state.notice ? `${styles.status} ${styles.notice}` : styles.status} role="status" aria-live="polite">
          {state.notice
            ? noticeText(state.notice)
            : check === null
            ? state.solved
              ? 'Эта головоломка уже решена. Можно перепроверить или начать заново.'
              : 'Выберите клетку и печатайте буквы. Стрелки — переход, Backspace — стереть.'
            : check.solved
              ? 'Решено верно!'
              : check.wrong.length > 0
                ? `Есть ошибки: неверных номеров ${check.wrong.length}${check.missing ? `, не заполнено ${check.missing}` : ''}.`
                : `Ошибок нет, осталось заполнить номеров: ${check.missing}.`}
        </p>
      </div>

      <input
        ref={inputRef}
        className="visually-hidden"
        aria-label="Ввод буквы в выбранную клетку"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        onKeyDown={handleKeyDown}
        onChange={(event) => handleInput(event.target.value)}
      />

      <PuzzlePage
        view={view}
        grid={
          <PuzzleGrid
            view={view}
            letters={state.entries}
            givenNumbers={givenNumbers}
            selected={state.selected}
            direction={state.direction}
            wrongNumbers={wrongNumbers}
            noticeNumbers={noticeNumbers}
            onCellClick={handleCellClick}
          />
        }
        keyStrip={
          <KeyStrip
            entries={view.key}
            letters={state.entries}
            givenNumbers={givenNumbers}
            wrongNumbers={wrongNumbers}
            noticeNumbers={noticeNumbers}
            selectedNumber={selectedNumber}
          />
        }
      />
    </div>
  );
}
