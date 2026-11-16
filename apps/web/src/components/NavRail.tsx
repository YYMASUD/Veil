import { useTheme } from '../useTheme';

/** Left navigation rail: brand, primary actions, theme toggle. */
export function NavRail() {
  const { theme, toggleTheme } = useTheme();
  return (
    <nav className="rail" aria-label="Primary">
      <div className="brand-mark" aria-hidden="true">
        V
      </div>
      <button className="icon-button" aria-label="New chat" type="button">
        ＋
      </button>
      <div className="rail-spacer" />
      <button
        className="icon-button"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
        type="button"
      >
        {theme === 'dark' ? '☼' : '☾'}
      </button>
      <button className="icon-button" aria-label="Settings" type="button">
        ⚙
      </button>
    </nav>
  );
}
