import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Controlled ticker input with autocomplete dropdown.
 *
 * Props:
 *   value       — current ticker string (e.g. "AAPL"), controlled by parent
 *   onChange    — called with new ticker string on every keystroke
 *   onSelect    — called with (symbol, name) when user picks from dropdown
 *   placeholder — input placeholder text
 *   inputClass  — additional Tailwind classes for the <input>
 */
export default function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'es. AAPL',
  inputClass = '',
}) {
  const [debouncedQuery, setDebounced] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Debounce keystrokes for API call
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => setSelectedIndex(-1), [debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery.length < 2) setIsOpen(false);
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const showDropdown = isOpen && debouncedQuery.length >= 2;

  function handleSelect(result) {
    onSelect(result.symbol, result.description);
    setIsOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else {
        setIsOpen(false);
      }
    }
  }

  const baseInput = `px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200
    dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400
    focus:outline-none focus:ring-2 focus:ring-blue-500 w-full`;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const upper = e.target.value.toUpperCase();
          onChange(upper);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (debouncedQuery.length >= 2) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`${baseInput} ${inputClass}`}
      />

      {showDropdown && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border
                        border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading && (
            <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              Ricerca in corso…
            </li>
          )}
          {!isLoading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
              Nessun risultato per &ldquo;{debouncedQuery}&rdquo;
            </li>
          )}
          {!isLoading &&
            results.map((r, i) => (
              <li
                key={r.symbol}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(r);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`px-4 py-2.5 cursor-pointer flex items-baseline gap-2 transition-colors ${
                  i === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 shrink-0">
                  {r.symbol}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {r.description}
                </span>
                {r.type && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto shrink-0">
                    {r.type}
                  </span>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
