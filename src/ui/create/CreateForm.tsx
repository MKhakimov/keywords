import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import type { Difficulty } from '../../core/puzzle/types.ts';
import type { PuzzleFormValues } from './formModel.ts';
import { GRID_LIMITS, PLACEHOLDER_ILLUSTRATION, randomSeed, validateForm } from './formModel.ts';
import { readImageFile } from '../shared/readImage.ts';
import styles from './CreateForm.module.scss';

export interface CreateFormProps {
  readonly initialValues: PuzzleFormValues;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (values: PuzzleFormValues) => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Лёгкая — только частотные слова' },
  { value: 'medium', label: 'Средняя' },
  { value: 'hard', label: 'Сложная — редкие слова, меньше подсказок' },
];

export function CreateForm({ initialValues, busy, error, onSubmit }: CreateFormProps) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const errors = validateForm(values);
  const hasErrors = Object.keys(errors).length > 0;

  const set = <K extends keyof PuzzleFormValues>(key: K, value: PuzzleFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const text = (key: 'rubric' | 'heading' | 'riddle' | 'explanation' | 'answer' | 'theme' | 'illustrationAlt') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, event.target.value);
  const number = (key: 'width' | 'height' | 'seed') => (event: ChangeEvent<HTMLInputElement>) =>
    set(key, event.target.value === '' ? Number.NaN : Number(event.target.value));

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    readImageFile(file)
      .then((src) => {
        setImageError(null);
        setValues((current) => ({
          ...current,
          illustrationSrc: src,
          illustrationPlaceholder: false,
          illustrationAlt: current.illustrationPlaceholder ? '' : current.illustrationAlt,
        }));
      })
      .catch((error: unknown) => setImageError(error instanceof Error ? error.message : String(error)));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!hasErrors) onSubmit(values);
  };

  const fieldError = (key: keyof PuzzleFormValues) =>
    touched && errors[key] ? (
      <span className={styles.error} id={`${key}-error`}>
        {errors[key]}
      </span>
    ) : null;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.group} disabled={busy}>
        <legend>Текст</legend>
        <label className={styles.field}>
          <span>Рубрика</span>
          <input value={values.rubric} onChange={text('rubric')} />
        </label>
        <label className={styles.field}>
          <span>Заголовок</span>
          <input value={values.heading} onChange={text('heading')} aria-invalid={touched && !!errors.heading} />
          {fieldError('heading')}
        </label>
        <label className={styles.field}>
          <span>Загадка</span>
          <textarea rows={2} value={values.riddle} onChange={text('riddle')} />
        </label>
        <label className={styles.field}>
          <span>Пояснение</span>
          <textarea rows={3} value={values.explanation} onChange={text('explanation')} />
          <small>Без прямой подсказки ответа и без непроверенных фактов.</small>
        </label>
        <label className={styles.field}>
          <span>Ответ</span>
          <input value={values.answer} onChange={text('answer')} aria-invalid={touched && !!errors.answer} />
          <small>Одно или два слова, каждое не короче двух букв. Попадёт в жёлтую колонку.</small>
          {fieldError('answer')}
        </label>
      </fieldset>

      <fieldset className={styles.group} disabled={busy}>
        <legend>Сетка</legend>
        <label className={styles.field}>
          <span>Тема</span>
          <input value={values.theme} onChange={text('theme')} />
        </label>
        <label className={styles.field}>
          <span>Сложность</span>
          <select value={values.difficulty} onChange={(event) => set('difficulty', event.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Ширина</span>
            <input
              type="number"
              min={GRID_LIMITS.minWidth}
              max={GRID_LIMITS.maxWidth}
              value={Number.isNaN(values.width) ? '' : values.width}
              onChange={number('width')}
            />
            {fieldError('width')}
          </label>
          <label className={styles.field}>
            <span>Высота</span>
            <input
              type="number"
              min={GRID_LIMITS.minHeight}
              max={GRID_LIMITS.maxHeight}
              value={Number.isNaN(values.height) ? '' : values.height}
              onChange={number('height')}
            />
            {fieldError('height')}
          </label>
          <label className={styles.field}>
            <span>Seed</span>
            <span className={styles.seed}>
              <input type="number" min={0} value={Number.isNaN(values.seed) ? '' : values.seed} onChange={number('seed')} />
              <button type="button" onClick={() => set('seed', randomSeed())} aria-label="Случайный seed">
                ⟳
              </button>
            </span>
            {fieldError('seed')}
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={busy}>
        <legend>Иллюстрация</legend>
        <div className={styles.illustration}>
          <img src={values.illustrationSrc} alt="" />
          <div className={styles.illustrationControls}>
            <label className={styles.field}>
              <span>Файл изображения</span>
              <input type="file" accept="image/*" onChange={handleFile} />
              {imageError && <span className={styles.error}>{imageError}</span>}
            </label>
            {!values.illustrationPlaceholder && (
              <button
                type="button"
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    illustrationSrc: PLACEHOLDER_ILLUSTRATION,
                    illustrationPlaceholder: true,
                    illustrationAlt: initialValues.illustrationAlt,
                  }))
                }
              >
                Вернуть шаблон
              </button>
            )}
            <label className={styles.field}>
              <span>Описание для незрячих</span>
              <input value={values.illustrationAlt} onChange={text('illustrationAlt')} />
            </label>
            {values.illustrationPlaceholder && <small>Шаблонная иллюстрация — только для разработки.</small>}
          </div>
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Строю сетку…' : 'Создать головоломку'}
        </button>
        {error && (
          <p className={styles.failure} role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
