import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Puzzle } from '../../core/puzzle/types.ts';
import { PuzzleRepository } from '../../storage/puzzleRepository.ts';
import type { SavedPuzzle, SavedPuzzleSummary } from '../../storage/types.ts';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useLibrary() {
  const repository = useMemo(() => new PuzzleRepository(), []);
  const [items, setItems] = useState<SavedPuzzleSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => repository.close(), [repository]);

  const refresh = useCallback(async () => {
    try {
      setItems(await repository.list());
      setError(null);
    } catch (e) {
      setError(`Сохранение недоступно: ${message(e)}`);
    } finally {
      setLoaded(true);
    }
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    repository
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(`Сохранение недоступно: ${message(e)}`);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const save = useCallback(
    async (puzzle: Puzzle): Promise<SavedPuzzle | null> => {
      try {
        const record = await repository.save(puzzle);
        void refresh();
        return record;
      } catch (e) {
        setError(`Не удалось сохранить головоломку: ${message(e)}`);
        return null;
      }
    },
    [repository, refresh],
  );

  const saveProgress = useCallback(
    async (id: string, progress: Readonly<Record<number, string>>, solved: boolean) => {
      try {
        await repository.saveProgress(id, progress, solved);
      } catch (e) {
        setError(`Не удалось сохранить прогресс: ${message(e)}`);
      }
    },
    [repository],
  );

  const load = useCallback(
    async (id: string): Promise<SavedPuzzle | null> => {
      try {
        const record = await repository.get(id);
        if (!record) setError('Головоломка не найдена или повреждена');
        return record;
      } catch (e) {
        setError(`Не удалось открыть головоломку: ${message(e)}`);
        return null;
      }
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await repository.delete(id);
        await refresh();
      } catch (e) {
        setError(`Не удалось удалить головоломку: ${message(e)}`);
      }
    },
    [repository, refresh],
  );

  return { items, loaded, error, refresh, save, saveProgress, load, remove };
}
