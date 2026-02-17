import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';


interface LabelManagerProps {
  currentLabels: string[];
  repoLabels: Array<{ name: string; color: string }>;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const MAX_LABELS = 100;

export function LabelManager({
  currentLabels,
  repoLabels,
  onAddLabel,
  onRemoveLabel,
  disabled,
  isLoading,
}: LabelManagerProps) {
  const { t } = useTranslation('common');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const atLimit = currentLabels.length >= MAX_LABELS;

  const filteredLabels = repoLabels.filter((label) =>
    label.name.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function toggleDropdown() {
    setDropdownOpen((prev) => !prev);
    setSearch('');
  }

  return (
    <section className="space-y-2" aria-label={t('labels.manage')}>
      {/* Current labels */}
      <div className="flex flex-wrap gap-1.5">
        {currentLabels.map((label) => {
          const repoLabel = repoLabels.find((rl) => rl.name === label);
          const labelColor = repoLabel ? `#${repoLabel.color}` : undefined;
          return (
            <Badge
              key={label}
              variant="outline"
              className="gap-1 text-xs"
              style={labelColor ? {
                backgroundColor: `${labelColor}20`,
                borderColor: `${labelColor}40`,
                color: labelColor,
              } : undefined}
            >
              {label}
              {!disabled && (
                <button
                  type="button"
                  className="ml-0.5 opacity-70 hover:opacity-100"
                  onClick={() => onRemoveLabel(label)}
                  aria-label={t('labels.removeNamed', { name: label })}
                  style={labelColor ? { color: labelColor } : undefined}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {/* Add label button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={toggleDropdown}
        disabled={disabled || atLimit || isLoading}
        aria-label={t('labels.add')}
      >
        <Plus className="h-3 w-3" />
        {t('labels.add')}
      </Button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div ref={dropdownRef} className="border border-border rounded-md bg-popover shadow-md p-1 max-h-48 overflow-y-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('labels.filter')}
            className="w-full px-2 py-1 text-xs border-b border-border bg-transparent focus:outline-none"
            aria-label={t('labels.filter')}
          />
          <div role="listbox" aria-label={t('labels.available')}>
            {filteredLabels.map((label) => {
              const isApplied = currentLabels.includes(label.name);
              return (
                <div
                  key={label.name}
                  role="option"
                  tabIndex={0}
                  aria-selected={isApplied}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isApplied) onAddLabel(label.name);
                    } else if (e.key === 'Escape') {
                      setDropdownOpen(false);
                      setSearch('');
                    }
                  }}
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-sm text-left"
                    onClick={() => {
                      if (!isApplied) {
                        onAddLabel(label.name);
                      }
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    <span className="flex-1">{label.name}</span>
                    {isApplied && <Check className="h-3 w-3 text-primary" />}
                  </button>
                </div>
              );
            })}
            {filteredLabels.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('labels.noMatch')}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
