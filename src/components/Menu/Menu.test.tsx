import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

function setup(label?: string) {
  const onNew = vi.fn();
  const onWin = vi.fn();
  render(
    <div>
      <Menu
        label={label}
        items={[
          { label: 'New board', onSelect: onNew },
          { label: 'We have a winner', onSelect: onWin },
        ]}
      />
      <button type="button">Outside</button>
    </div>,
  );
  const trigger = screen.getByRole('button', { name: label ?? 'Menu' });
  return { onNew, onWin, trigger, user: userEvent.setup() };
}

describe('Menu', () => {
  it('renders a closed menu button with aria-haspopup', () => {
    const { trigger } = setup();
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('uses a custom label as accessible name', () => {
    setup('Options');
    expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument();
  });

  it('opens a menu of menuitem buttons and focuses the first item', async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Menu' });
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['New board', 'We have a winner']);
    items.forEach((i) => expect(i.tagName).toBe('BUTTON'));
    expect(items[0]).toHaveFocus();
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each([
    ['New board', 'onNew'],
    ['We have a winner', 'onWin'],
  ] as const)(
    'selecting "%s" calls its callback, closes and refocuses the trigger',
    async (label, key) => {
      const ctx = setup();
      await ctx.user.click(ctx.trigger);
      await ctx.user.click(screen.getByRole('menuitem', { name: label }));
      expect(ctx[key]).toHaveBeenCalledTimes(1);
      expect(ctx[key === 'onNew' ? 'onWin' : 'onNew']).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(ctx.trigger).toHaveAttribute('aria-expanded', 'false');
      expect(ctx.trigger).toHaveFocus();
    },
  );

  it('activates an item with Enter', async () => {
    const { trigger, user, onNew } = setup();
    await user.click(trigger);
    await user.keyboard('{Enter}');
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { trigger, user, onNew, onWin } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onNew).not.toHaveBeenCalled();
    expect(onWin).not.toHaveBeenCalled();
  });

  it('closes on Escape while the trigger has focus', async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    trigger.focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click without selecting', async () => {
    const { trigger, user, onNew, onWin } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onNew).not.toHaveBeenCalled();
    expect(onWin).not.toHaveBeenCalled();
  });

  it('closes on Tab', async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves focus with arrow keys, Home and End (wrapping)', async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    const [first, second] = screen.getAllByRole('menuitem');
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(second).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    await user.keyboard('{End}');
    expect(second).toHaveFocus();
  });
});
