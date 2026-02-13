import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '../../ui/button';

interface AssigneeManagerProps {
  currentAssignees: Array<{ login: string; avatarUrl?: string }>;
  collaborators: string[];
  onAddAssignee: (login: string) => void;
  onRemoveAssignee: (login: string) => void;
  disabled?: boolean;
}

export function AssigneeManager({
  currentAssignees,
  collaborators,
  onAddAssignee,
  onRemoveAssignee,
  disabled,
}: AssigneeManagerProps) {
  const { t } = useTranslation('common');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const assignedLogins = new Set(currentAssignees.map((a) => a.login));

  const filteredCollaborators = collaborators.filter((login) =>
    login.toLowerCase().includes(search.toLowerCase()),
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
    <section className="space-y-2" aria-label="Assignee manager">
      {/* Current assignees */}
      <div className="flex flex-wrap gap-1.5">
        {currentAssignees.map((assignee) => (
          <div
            key={assignee.login}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs"
          >
            {assignee.avatarUrl && (
              <img
                src={assignee.avatarUrl}
                alt=""
                className="w-4 h-4 rounded-full"
              />
            )}
            <span>{assignee.login}</span>
            {!disabled && (
              <button
                type="button"
                className="hover:text-destructive"
                onClick={() => onRemoveAssignee(assignee.login)}
                aria-label={`Remove assignee ${assignee.login}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Assign button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={toggleDropdown}
        disabled={disabled}
        aria-label="Assign"
      >
        <Plus className="h-3 w-3" />
        {t('assignees.assign')}
      </Button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div ref={dropdownRef} className="border border-border rounded-md bg-popover shadow-md p-1 max-h-48 overflow-y-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('assignees.search')}
            className="w-full px-2 py-1 text-xs border-b border-border bg-transparent focus:outline-none"
            aria-label="Search collaborators"
          />
          <div role="listbox" aria-label="Available collaborators">
            {filteredCollaborators.map((login) => {
              const isAssigned = assignedLogins.has(login);
              return (
                <div key={login} role="option" tabIndex={0} aria-selected={isAssigned}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-sm text-left"
                    onClick={() => {
                      if (!isAssigned) {
                        onAddAssignee(login);
                      }
                    }}
                  >
                    <span className="flex-1">{login}</span>
                    {isAssigned && <Check className="h-3 w-3 text-primary" />}
                  </button>
                </div>
              );
            })}
            {filteredCollaborators.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('assignees.noMatch')}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
