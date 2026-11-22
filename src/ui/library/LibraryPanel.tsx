import type { Difficulty } from '../../core/puzzle/types.ts';
import type { SavedPuzzleSummary } from '../../storage/types.ts';
import styles from './LibraryPanel.module.scss';

export interface LibraryPanelProps {
  readonly items: readonly SavedPuzzleSummary[];
  readonly loaded: boolean;
  readonly currentId: string | null;
  readonly onOpen: (id: string, target: 'play' | 'editor') => void;
  readonly onDelete: (id: string) => void;
  readonly onCreate: () => void;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'лёгкая', medium: 'средняя', hard: 'сложная' };

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
};

export function LibraryPanel({ items, loaded, currentId, onOpen, onDelete, onCreate }: LibraryPanelProps) {
  if (!loaded) return <p className={styles.empty}>Загружаю сохранённые головоломки…</p>;

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Пока нет сохранённых головоломок. Каждая созданная головоломка появится здесь автоматически.</p>
        <button type="button" className={styles.primary} onClick={onCreate}>
          Создать головоломку
        </button>
      </div>
    );
  }

  return (
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
  );
}
