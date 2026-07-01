import { useTheme } from '../lib/theme';

/** Sun/moon theme switch. `variant="floating"` pins it to the top-right for
 *  the centered auth/setup screens; default sits inline in the sidebar. */
export function ThemeToggle({ variant }: { variant?: 'floating' }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle${variant === 'floating' ? ' theme-toggle-floating' : ''}`}
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      <span className="theme-toggle-label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
