/**
 * Enrichment Comment Preview — preview and edit markdown comment before posting.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENRICHMENT_COMMENT_FOOTER } from '../../../../shared/constants/ai-triage';

interface EnrichmentCommentPreviewProps {
  content: string;
  onPost: (content: string) => void;
  onCancel: () => void;
}

export function EnrichmentCommentPreview({ content: initialContent, onPost, onCancel }: EnrichmentCommentPreviewProps) {
  const { t } = useTranslation(['common']);
  const [content, setContent] = useState(initialContent);

  const handlePost = () => {
    const fullContent = `${content}\n\n${ENRICHMENT_COMMENT_FOOTER}`;
    onPost(fullContent);
  };

  return (
    <section className="space-y-3" aria-label={t('common:enrichmentComment.title')}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full bg-transparent text-sm border border-border/50 rounded p-3 outline-none focus:border-blue-500 min-h-[120px] resize-y"
        aria-label={t('common:enrichmentComment.content')}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/50">
          {content.length} {t('common:enrichmentComment.characters')}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t('common:enrichmentComment.cancel')}
            className="text-xs px-3 py-1.5 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
            onClick={onCancel}
          >
            {t('common:enrichmentComment.cancel')}
          </button>
          <button
            type="button"
            aria-label={t('common:enrichmentComment.post')}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            onClick={handlePost}
          >
            {t('common:enrichmentComment.post')}
          </button>
        </div>
      </div>
    </section>
  );
}
