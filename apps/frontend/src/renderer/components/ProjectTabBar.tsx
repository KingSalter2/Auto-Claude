import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { SortableProjectTab } from './SortableProjectTab';
import { UsageIndicator } from './UsageIndicator';
import { AuthStatusIndicator } from './AuthStatusIndicator';
import { useWindowStore } from '../stores/window-store';
import type { Project } from '../../shared/types';

interface ProjectTabBarProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onAddProject: () => void;
  className?: string;
  // Control props for active tab
  onSettingsClick?: () => void;
}

export function ProjectTabBar({
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectClose,
  onAddProject,
  className,
  onSettingsClick
}: ProjectTabBarProps) {
  const { t } = useTranslation('common');
  const { isProjectPoppedOut, setWindowLoading, addPoppedOutProject } = useWindowStore();

  // Handler for popping out a project into a new window
  const handlePopOutProject = async (projectId: string) => {
    try {
      setWindowLoading(projectId, true);
      const result = await window.electronAPI.window.popOutProject(projectId);

      // Check if the result indicates an error (IPC handler returns success/error structure)
      if ('success' in result && result.success === false && 'error' in result) {
        const error = result.error as {
          code: string;
          message: string;
          existingWindowId?: number;
        };

        // If project already popped out, focus the existing window
        if (error.code === 'ALREADY_POPPED_OUT' && error.existingWindowId) {
          await window.electronAPI.window.focusWindow(error.existingWindowId);
          console.log(`Project ${projectId} already popped out, focused existing window ${error.existingWindowId}`);
        } else {
          console.error('Failed to pop out project:', error.message);
          // TODO: Show error notification to user
        }
        return;
      }

      // Success path - result is { success: true, windowId: number }
      const successResult = result as { success: true; windowId: number };
      addPoppedOutProject(projectId);
      console.log(`Project ${projectId} popped out to window ${successResult.windowId}`);
    } catch (error) {
      console.error('Failed to pop out project:', error);
      // TODO: Show error notification to user
    } finally {
      setWindowLoading(projectId, false);
    }
  };

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Cmd/Ctrl + 1-9: Switch to tab N
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (index < projects.length) {
          onProjectSelect(projects[index].id);
        }
        return;
      }

      // Cmd/Ctrl + Tab: Next tab
      // Cmd/Ctrl + Shift + Tab: Previous tab
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = projects.findIndex((p) => p.id === activeProjectId);
        if (currentIndex === -1 || projects.length === 0) return;

        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + projects.length) % projects.length
          : (currentIndex + 1) % projects.length;
        onProjectSelect(projects[nextIndex].id);
        return;
      }

      // Cmd/Ctrl + W: Close current tab (only if more than one tab)
      if (e.key === 'w' && activeProjectId && projects.length > 1) {
        e.preventDefault();
        onProjectClose(activeProjectId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, activeProjectId, onProjectSelect, onProjectClose]);

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center border-b border-border bg-background',
      'overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
      className
    )}>
      <div className="flex items-center flex-1 min-w-0">
        {projects.map((project, index) => {
          const isActiveTab = activeProjectId === project.id;
          return (
            <SortableProjectTab
              key={project.id}
              project={project}
              isActive={isActiveTab}
              canClose={projects.length > 1}
              tabIndex={index}
              onSelect={() => onProjectSelect(project.id)}
              onClose={(e) => {
                e.stopPropagation();
                onProjectClose(project.id);
              }}
              // Pass control props only for active tab
              onSettingsClick={isActiveTab ? onSettingsClick : undefined}
              onPopOutClick={isActiveTab ? () => handlePopOutProject(project.id) : undefined}
              isPoppedOut={isProjectPoppedOut(project.id)}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-2 py-1">
        <AuthStatusIndicator />
        <UsageIndicator />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onAddProject}
          aria-label={t('projectTab.addProjectAriaLabel')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
