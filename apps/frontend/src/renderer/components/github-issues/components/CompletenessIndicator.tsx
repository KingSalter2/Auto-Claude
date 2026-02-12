interface CompletenessIndicatorProps {
  score: number | null | undefined;
  compact?: boolean;
}

export function CompletenessIndicator({ score, compact }: CompletenessIndicatorProps) {
  const hasScore = score !== null && score !== undefined;
  const displayText = hasScore ? `${score}%` : 'Not assessed';
  const ariaLabel = hasScore ? `Completeness: ${score} percent` : 'Not assessed';

  if (compact) {
    return (
      <span className="text-xs text-muted-foreground" role="status" aria-label={ariaLabel}>
        {displayText}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2" role="status" aria-label={ariaLabel}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        {hasScore && (
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${score}%` }}
          />
        )}
      </div>
      <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
        {displayText}
      </span>
    </div>
  );
}
