import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, FileArchive, Image as ImageIcon } from 'lucide-react';
import { useGame, useUploadGame, useUpdateGame } from '@/hooks/useGames';
import { uploadPostMedia } from '@/lib/storage';
import { parseTags } from '@/lib/tags';
import { labelStyle, inputStyle } from '@/styles/forms';

const MAX_TAGS = 10;

const GameUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editSlug = searchParams.get('edit') || undefined;
  const isEdit = !!editSlug;

  const { data: editing } = useGame(editSlug);
  const uploadGame = useUploadGame();
  const updateGame = useUpdateGame();

  const archiveInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);

  // Prefill once when editing an existing submission.
  useEffect(() => {
    if (isEdit && editing && !prefilled.current) {
      prefilled.current = true;
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setTagsInput(editing.tags.map((t) => t.name).join(', '));
    }
  }, [isEdit, editing]);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const pending = uploadGame.isPending || updateGame.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Укажите название игры'); return; }
    if (tags.length > MAX_TAGS) { setError(`Максимум ${MAX_TAGS} тегов`); return; }
    if (!isEdit && !archiveFile) { setError('Прикрепите .zip с игрой (index.html в корне)'); return; }

    try {
      let thumbnailUrl: string | undefined;
      if (thumbFile) thumbnailUrl = await uploadPostMedia(thumbFile);

      const input = {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl ?? null,
        tags,
        archive: archiveFile,
      };

      if (isEdit && editSlug) {
        await updateGame.mutateAsync({ slug: editSlug, input });
      } else {
        await uploadGame.mutateAsync(input);
      }
      navigate('/me/games');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
        {isEdit ? 'Редактировать игру' : 'Загрузить мини-игру'}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Игра — это <code>.zip</code> со статическими файлами (в корне обязательно <code>index.html</code>).
        После загрузки игра попадёт на модерацию и станет доступна всем после одобрения.
      </p>

      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div>
          <label style={labelStyle}>Название</label>
          <input type="text" style={inputStyle} value={title} maxLength={150}
            onChange={(e) => setTitle(e.target.value)} placeholder="Моя крутая игра" required autoFocus />
        </div>

        <div>
          <label style={labelStyle}>Описание</label>
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }}
            value={description} maxLength={2000}
            onChange={(e) => setDescription(e.target.value)} placeholder="О чём игра, как играть…" />
        </div>

        <div>
          <label style={labelStyle}>Теги</label>
          <input type="text" style={inputStyle} value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)} placeholder="аркада, головоломка, js" />
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {tags.map((t) => (
                <span key={t} style={{ padding: '3px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 999, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Archive */}
        <div>
          <label style={labelStyle}>Архив игры (.zip){isEdit ? ' — необязательно при редактировании' : ''}</label>
          <input ref={archiveInput} type="file" accept=".zip,application/zip" hidden
            onChange={(e) => setArchiveFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => archiveInput.current?.click()}
            style={fileButtonStyle(!!archiveFile)}>
            <FileArchive size={18} />
            {archiveFile ? archiveFile.name : (isEdit ? 'Заменить .zip (опционально)' : 'Выбрать .zip')}
          </button>
        </div>

        {/* Thumbnail */}
        <div>
          <label style={labelStyle}>Обложка (изображение, необязательно)</label>
          <input ref={thumbInput} type="file" accept="image/*" hidden
            onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => thumbInput.current?.click()}
            style={fileButtonStyle(!!thumbFile)}>
            <ImageIcon size={18} />
            {thumbFile ? thumbFile.name : 'Выбрать обложку'}
          </button>
        </div>

        {error && <div style={{ color: 'var(--error)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={() => navigate(-1)}
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}>
            Отмена
          </button>
          <button type="submit" disabled={pending} className="btn btn-primary" style={{ gap: 8, opacity: pending ? 0.6 : 1 }}>
            <Upload size={14} />
            {pending ? 'Отправка…' : (isEdit ? 'Отправить на модерацию' : 'Загрузить')}
          </button>
        </div>
      </form>
    </div>
  );
};

function fileButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 10,
    background: active ? 'oklch(0.25 0.04 145 / 0.3)' : 'var(--bg-2)',
    border: `1px solid ${active ? 'oklch(0.55 0.15 145)' : 'var(--border)'}`,
    borderRadius: 8,
    color: active ? 'oklch(0.78 0.15 145)' : 'var(--text-3)',
    fontSize: 13, fontFamily: 'var(--font-ui)',
    textAlign: 'left',
  };
}

export default GameUploadPage;
