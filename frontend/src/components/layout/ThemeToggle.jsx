import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { Button } from '@tremor/react';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="light"
      color="slate"
      size="xs"
      icon={isDark ? SunIcon : MoonIcon}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
    />
  );
}
