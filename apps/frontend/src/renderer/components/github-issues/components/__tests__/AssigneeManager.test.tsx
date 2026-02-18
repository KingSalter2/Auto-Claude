/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AssigneeManager } from '../AssigneeManager';

const collaborators = ['alice', 'bob', 'charlie'];

// Create test i18n instance
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  resources: {
    en: {
      common: {
        'assignees.title': 'Assignees',
        'assignees.manage': 'Manage assignees',
        'assignees.assign': 'Assign',
        'assignees.unassign': 'Unassign',
        'assignees.search': 'Search collaborators...',
        'assignees.noMatch': 'No matching collaborators'
      }
    }
  }
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
}

describe('AssigneeManager', () => {
  it('renders current assignees', () => {
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[
          { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
          { login: 'bob' },
        ]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('remove button fires onRemoveAssignee', () => {
    const onRemoveAssignee = vi.fn();
    const { container } = renderWithI18n(
      <AssigneeManager
        currentAssignees={[{ login: 'alice' }]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={onRemoveAssignee}
      />,
    );
    // Find the button by aria-label (the component uses 'Unassign' as aria-label)
    const button = container.querySelector('button[aria-label="Unassign"]');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onRemoveAssignee).toHaveBeenCalledWith('alice');
  });

  it('assign button opens dropdown', () => {
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('selecting fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    fireEvent.click(screen.getByText('alice'));
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Enter key on option fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Space key on option fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: ' ' });
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Escape key closes dropdown', () => {
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByRole('listbox')).toBeDefined();
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter key does not fire onAddAssignee for already-assigned user', () => {
    const onAddAssignee = vi.fn();
    renderWithI18n(
      <AssigneeManager
        currentAssignees={[{ login: 'alice' }]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { selected: true });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddAssignee).not.toHaveBeenCalled();
  });

  it('aria-label present on container', () => {
    const { container } = renderWithI18n(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    const el = container.querySelector('[aria-label="Manage assignees"]');
    expect(el).not.toBeNull();
  });
});
