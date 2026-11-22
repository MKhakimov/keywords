import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import type { Difficulty } from '../../core/puzzle/types.ts';
import type { ImportReport } from '../../storage/importPuzzles.ts';
import type { SavedPuzzleSummary } from '../../storage/types.ts';
import styles from './LibraryPanel.module.scss';

export interface LibraryPanelProps {
  readonly items: readonly SavedPuzzleSummary[];
  readonly loaded: boolean;
  readonly currentId: string | null;
  readonly onOpen: (id: string, target: 'play' | 'editor') => void;
  readonly onDelete: (id: string) => void;
  readonly onCreate: () => void;
  readonly onExport: (id?: string) => void;
  readonly onImport: (file: File) => Promise<ImportReport | null>;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'лёгкая', medium: 'средняя', hard: 'сложная' };

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
};

function ImportSummary({ report, onClose }: { readonly report: ImportReport; readonly onClose: () => void }) {
  const nothing = report.added.length + report.skipped.length + report.rejected.length === 0;
  return (
    <section className={styles.report} role="status" aria-live="polite">
      <div className={styles.reportHeader}>
        <h2>Импорт завершён</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть отчёт">
          ×
        </button>
      </div>
      {nothing && <p>В файле нет головоломок.</p>}
      {report.added.length > 0 && (
        <p className={styles.added}>
          Добавлено: {report.added.length} — {report.added.join(', ')}
        </p>
      )}
      {report.skipped.length > 0 && (
        <p>
          Уже есть, пропущено: {report.skipped.length} — {report.skipped.join(', ')}
        </p>
      )}
      {report.rejected.length > 0 && (
        <>
          <p className={styles.rejected}>Отклонено: {report.rejected.length}</p>
          <ul className={styles.rejectedList}>
            {report.rejected.map((item, i) => (
              <li key={i}>
                {item.label}: {item.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function LibraryPanel({ items, loaded, currentId, onOpen, onDelete, onCreate, onExport, onImport }: LibraryPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setReport(null);
    try {
      setReport(await onImport(file));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? 'Проверяю головоломки…' : 'Импорт JSON'}
        </button>
        <button type="button" onClick={() => onExport()} disabled={items.length === 0 || importing}>
          Экспортировать всё
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void handleFile(event)}
        />
      </div>

      {report && <ImportSummary report={report} onClose={() => setReport(null)} />}

      {!loaded && <p className={styles.empty}>Загружаю сохранённые головоломки…</p>}

      {loaded && items.length === 0 && (
        <div className={styles.empty}>
          <p>Пока нет сохранённых головоломок. Создайте новую или импортируйте файл экспорта.</p>
          <button type="button" className={styles.primary} onClick={onCreate}>
            Создать головоломку
          </button>
        </div>
      )}

      {loaded && items.length > 0 && (
        <ul className={styles.list} aria-label="Сохранённые головоломки">
          {items.map((item) => (
            <li key={item.id} className={item.id === currentId ? `${styles.item} ${styles.current}` : styles.item}>
              <div className={styles.info}>
                <h2 className={styles.heading}>{item.heading}</h2>
                <p className={styles.meta}>
                  {formatDate(item.createdAt)} · {DIFFICULTY_LABEL[item.difficulty]} · {item.width}×{item.height}
                  {item.theme ? ` · ${item.theme}` : ''}
                </p>
                <p className={item.solved ? `${styles.progress} ${styles.solved}` : styles.progress}>
                  {item.solved ? 'Решено' : `Открыто букв: ${item.filled} из ${item.total}`}
                </p>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={() => onOpen(item.id, 'play')}>
                  Играть
                </button>
                <button type="button" onClick={() => onOpen(item.id, 'editor')}>
                  Редактор
                </button>
                <button type="button" onClick={() => onExport(item.id)}>
                  Экспорт
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    if (window.confirm(`Удалить «${item.heading}»? Это действие нельзя отменить.`)) onDelete(item.id);
                  }}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
