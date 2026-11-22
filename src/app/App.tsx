import { useMemo, useState } from 'react';
import type { Puzzle } from '../core/puzzle/types.ts';
import { toPlayView } from '../core/puzzle/views.ts';
import type { SavedPuzzle } from '../storage/types.ts';
import { CreateForm } from '../ui/create/CreateForm.tsx';
import type { PuzzleFormValues } from '../ui/create/formModel.ts';
import { buildRequest, defaultFormValues } from '../ui/create/formModel.ts';
import { EditorPanel } from '../ui/editor/EditorPanel.tsx';
import { checkSolution } from '../ui/game/checkSolution.ts';
import { givenEntries } from '../ui/game/gameState.ts';
import { usePuzzleGenerator } from '../ui/hooks/usePuzzleGenerator.ts';
import { LibraryPanel } from '../ui/library/LibraryPanel.tsx';
import { useLibrary } from '../ui/library/useLibrary.ts';
import { PlayPanel } from '../ui/play/PlayPanel.tsx';
import { KeyStrip } from '../ui/puzzle/KeyStrip.tsx';
import { PuzzleGrid } from '../ui/puzzle/PuzzleGrid.tsx';
import { PuzzlePage } from '../ui/puzzle/PuzzlePage.tsx';
import styles from './App.module.scss';

type Tab = 'create' | 'library' | 'play' | 'editor';

const TABS: { id: Tab; label: string; needsPuzzle: boolean }[] = [
  { id: 'create', label: 'Создать', needsPuzzle: false },
  { id: 'library', label: 'Мои головоломки', needsPuzzle: false },
  { id: 'play', label: 'Игра', needsPuzzle: true },
  { id: 'editor', label: 'Редактор', needsPuzzle: true },
];

interface CurrentPuzzle {
  readonly puzzle: Puzzle;
  readonly progress: Readonly<Record<number, string>>;
  readonly solved: boolean;
  readonly openedAt: number;
}

function PrintablePage({ puzzle }: { readonly puzzle: Puzzle }) {
  const view = useMemo(() => toPlayView(puzzle), [puzzle]);
  const givens = useMemo(() => givenEntries(view), [view]);
  const givenNumbers = useMemo(() => new Set(Object.keys(givens).map(Number)), [givens]);
  return (
    <PuzzlePage
      view={view}
      grid={<PuzzleGrid view={view} letters={givens} givenNumbers={givenNumbers} />}
      keyStrip={<KeyStrip entries={view.key} letters={givens} givenNumbers={givenNumbers} />}
    />
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>('create');
  const [formValues, setFormValues] = useState<PuzzleFormValues>(defaultFormValues);
  const [current, setCurrent] = useState<CurrentPuzzle | null>(null);
  const { state, generate, validate } = usePuzzleGenerator();
  const library = useLibrary();
  const view = useMemo(() => (current ? toPlayView(current.puzzle) : null), [current]);

  const openRecord = (record: SavedPuzzle | { puzzle: Puzzle; progress: Record<number, string>; solved: boolean }) =>
    setCurrent({ puzzle: record.puzzle, progress: record.progress, solved: record.solved, openedAt: Date.now() });

  const handleSubmit = async (values: PuzzleFormValues) => {
    setFormValues(values);
    const created = await generate(buildRequest(values));
    if (!created) return;
    const saved = await library.save(created);
    openRecord(saved ?? { puzzle: created, progress: {}, solved: false });
    setTab('play');
  };

  const handleOpen = async (id: string, target: 'play' | 'editor') => {
    const record = await library.load(id);
    if (!record) return;
    openRecord(record);
    setTab(target);
  };

  const handleDelete = async (id: string) => {
    await library.remove(id);
    if (current?.puzzle.meta.id === id) setCurrent(null);
  };

  const switchTab = (next: Tab) => {
    if (next === 'library') void library.refresh();
    setTab(next);
  };

  return (
    <div className={styles.app}>
      <header className={styles.chrome}>
        <span className={styles.brand}>Кейворды</span>
        <nav className={styles.tabs} aria-label="Режимы">
          {TABS.map(({ id, label, needsPuzzle }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? `${styles.tab} ${styles.active}` : styles.tab}
              aria-current={tab === id ? 'page' : undefined}
              disabled={needsPuzzle && !current}
              onClick={() => switchTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className={styles.print} disabled={!current} onClick={() => window.print()}>
          Печать / PDF
        </button>
      </header>

      {library.error && (
        <p className={styles.warning} role="alert">
          {library.error}
        </p>
      )}

      <main className={styles.main}>
        {tab === 'create' && (
          <CreateForm
            initialValues={formValues}
            busy={state.status === 'loading'}
            error={state.status === 'error' ? state.message : null}
            onSubmit={handleSubmit}
          />
        )}
        {tab === 'library' && (
          <LibraryPanel
            items={library.items}
            loaded={library.loaded}
            currentId={current?.puzzle.meta.id ?? null}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onCreate={() => setTab('create')}
            onExport={(id) => void library.exportPuzzles(id)}
            onImport={(file) => library.importFile(file, validate)}
          />
        )}
        {tab === 'play' && current && view && (
          <PlayPanel
            key={`${current.puzzle.meta.id}:${current.openedAt}`}
            view={view}
            initialProgress={current.progress}
            initialSolved={current.solved}
            onCheck={(entries) => checkSolution(current.puzzle, entries)}
            onProgress={(entries, solved) => {
              setCurrent((prev) => (prev ? { ...prev, progress: entries, solved } : prev));
              void library.saveProgress(current.puzzle.meta.id, entries, solved);
            }}
          />
        )}
        {tab === 'editor' && current && <EditorPanel puzzle={current.puzzle} />}
      </main>

      {current && (
        <div className={styles.printOnly} aria-hidden="true">
          <PrintablePage puzzle={current.puzzle} />
        </div>
      )}
    </div>
  );
}
