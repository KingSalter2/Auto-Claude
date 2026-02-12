import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function CommentForm({
  onSubmit,
  isSubmitting,
  disabled,
}: CommentFormProps) {
  const { t } = useTranslation('common');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (body.trim() === '') {
      setError(t('commentForm.emptyError'));
      return;
    }

    setError(null);
    await onSubmit(body);
    setBody('');
    setMode('write');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2 border-b border-border pb-1">
        <button
          type="button"
          className={`text-xs px-2 py-1 rounded transition-colors ${
            mode === 'write'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground/60 hover:text-foreground'
          }`}
          onClick={() => setMode('write')}
        >
          {t('commentForm.write')}
        </button>
        <button
          type="button"
          className={`text-xs px-2 py-1 rounded transition-colors ${
            mode === 'preview'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground/60 hover:text-foreground'
          }`}
          onClick={() => setMode('preview')}
        >
          {t('commentForm.preview')}
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          placeholder={t('commentForm.placeholder')}
          rows={3}
          disabled={disabled || isSubmitting}
          aria-label={t('commentForm.submit')}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      ) : (
        <div className="min-h-[4.5rem] rounded-md border border-border bg-card px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none">
          {body ? (
            <ReactMarkdown>{body}</ReactMarkdown>
          ) : (
            <p className="text-foreground/40">{t('commentForm.placeholder')}</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={disabled || isSubmitting}
        className="gap-1.5"
      >
        {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isSubmitting ? t('commentForm.submitting') : t('commentForm.submit')}
      </Button>
    </form>
  );
}
