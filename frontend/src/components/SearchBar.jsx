import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TextInput, Button } from '@tremor/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';

export default function SearchBar() {
  const [inputValue, setInputValue]    = useState('');
  const [debouncedQuery, setDebounced] = useState('');
  const [selectedIndex, setSelected]   = useState(-1);
  const [isOpen, setIsOpen]            = useState(false);
  const navigate     = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  useEffect(() => setSelected(-1), [debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery.length < 2) setIsOpen(false);
  }, [debouncedQuery]);

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

  function goTo(symbol) {
    navigate(`/stock/${symbol}`);
    setIsOpen(false);
    setInputValue('');
    setDebounced('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); setIsOpen(false); return; }
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        goTo(results[selectedIndex].symbol);
      } else {
        const t = inputValue.trim().toUpperCase();
        if (t) navigate(`/stock/${t}`);
        setIsOpen(false);
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (selectedIndex >= 0 && results[selectedIndex]) {
      goTo(results[selectedIndex].symbol);
    } else {
      const t = inputValue.trim().toUpperCase();
      if (t) navigate(`/stock/${t}`);
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (debouncedQuery.length >= 2) setIsOpen(true); }}
          placeholder="Inserisci ticker (es. AAPL, MSFT, VWCE.DE)"
          autoComplete="new-password"
          icon={MagnifyingGlassIcon}
          className="flex-1"
        />
        <Button
          type="submit"
          color="blue"
          disabled={!inputValue.trim()}
        >
          Cerca
        </Button>
      </form>

      {showDropdown && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tremor-default shadow-tremor-dropdown dark:shadow-dark-tremor-dropdown z-50 overflow-hidden">
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
          {!isLoading && results.map((r, i) => (
            <li
              key={r.symbol}
              onMouseDown={e => { e.preventDefault(); goTo(r.symbol); }}
              onMouseEnter={() => setSelected(i)}
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
