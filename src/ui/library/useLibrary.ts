import { useCallback, useEffect, useMemo, useState } from 'react';
import { RU_ALPHABET } from '../../core/alphabet.ts';
import type { Puzzle } from '../../core/puzzle/types.ts';
import type { ValidationReport } from '../../core/validate/report.ts';
import { createExport, exportFileName, serializeExport } from '../../storage/exchange.ts';
import type { ImportReport } from '../../storage/importPuzzles.ts';
import { importPuzzles } from '../../storage/importPuzzles.ts';
import { PuzzleRepository } from '../../storage/puzzleRepository.ts';
import type { SavedPuzzle, SavedPuzzleSummary } from '../../storage/types.ts';
import { downloadText } from './download.ts';

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

  const exportPuzzles = useCallback(
    async (id?: string) => {
      try {
        const records = id ? [await repository.get(id)].filter((r): r is SavedPuzzle => r !== null) : await repository.listRecords();
        if (records.length === 0) {
          setError('Нечего экспортировать');
          return;
        }
        const now = new Date();
        downloadText(exportFileName(records, now), serializeExport(createExport(records, now)));
      } catch (e) {
        setError(`Не удалось экспортировать: ${message(e)}`);
      }
    },
    [repository],
  );

  const importFile = useCallback(
    async (file: File, validate: (puzzle: Puzzle) => Promise<ValidationReport>): Promise<ImportReport | null> => {
      try {
        const report = await importPuzzles(await file.text(), {
          alphabetId: RU_ALPHABET.id,
          validate,
          store: (item) => repository.importItem(item),
        });
        await refresh();
        return report;
      } catch (e) {
        setError(`Не удалось импортировать «${file.name}»: ${message(e)}`);
        return null;
      }
    },
    [repository, refresh],
  );

  return { items, loaded, error, refresh, save, saveProgress, load, remove, exportPuzzles, importFile };
}
