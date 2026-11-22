import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { PLACEHOLDER_ILLUSTRATION } from '../create/formModel.ts';
import { readImageFile } from '../shared/readImage.ts';
import type { Illustration } from './illustration.ts';
import styles from './EditorPanel.module.scss';

export interface IllustrationEditorProps {
  readonly illustration: Illustration;
  readonly onChange: (patch: Partial<Illustration>) => Promise<boolean>;
}

const PLACEHOLDER_ALT = 'Иллюстрация-заглушка: двое беседуют в комнате';

export function IllustrationEditor({ illustration, onChange }: IllustrationEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(illustration.alt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = async (patch: Partial<Illustration>, success: string) => {
    setBusy(true);
    try {
      const ok = await onChange(patch);
      setMessage(ok ? { ok: true, text: success } : { ok: false, text: 'Не удалось сохранить изменения' });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const src = await readImageFile(file);
      const nextAlt = illustration.placeholder ? '' : alt;
      setAlt(nextAlt);
      await apply({ src, placeholder: false, alt: nextAlt }, 'Иллюстрация заменена');
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <section className={styles.section}>
      <h2>Иллюстрация</h2>
      <img className={styles.preview} src={illustration.src} alt={illustration.alt} />
      {illustration.placeholder && <p className={styles.muted}>Сейчас стоит шаблонная картинка — только для разработки.</p>}
      <div className={styles.buttons}>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          Заменить файлом
        </button>
        {!illustration.placeholder && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAlt(PLACEHOLDER_ALT);
              void apply({ src: PLACEHOLDER_ILLUSTRATION, placeholder: true, alt: PLACEHOLDER_ALT }, 'Возвращена шаблонная картинка');
            }}
          >
            Вернуть шаблон
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void handleFile(event)}
        />
      </div>
      <label className={styles.field}>
        <span>Описание для незрячих</span>
        <span className={styles.inline}>
          <input value={alt} onChange={(event) => setAlt(event.target.value)} />
          <button
            type="button"
            disabled={busy || alt.trim() === illustration.alt}
            onClick={() => void apply({ alt: alt.trim() }, 'Описание сохранено')}
          >
            Сохранить
          </button>
        </span>
      </label>
      {message && (
        <p className={message.ok ? styles.ok : styles.bad} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
