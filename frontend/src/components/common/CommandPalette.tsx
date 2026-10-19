// ==============================================================================
// AssetVault: Command Palette Global Search (Ctrl + K / Cmd + K)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides instant multi-entity search across Assets, Licenses, Vendors, and Tags
// ==============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  KeyRound,
  Building2,
  Tag as TagIcon,
  X,
  ExternalLink,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { api } from '../../services/api';

interface SearchResultItem {
  id: string;
  type: 'asset' | 'license' | 'vendor' | 'tag';
  title: string;
  subtitle: string;
  url: string;
  status?: string;
  meta?: any;
}

interface SearchResponse {
  query: string;
  results: {
    assets: SearchResultItem[];
    licenses: SearchResultItem[];
    vendors: SearchResultItem[];
    tags: SearchResultItem[];
  };
  total: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse['results']>({
    assets: [],
    licenses: [],
    vendors: [],
    tags: [],
  });
  const [total, setTotal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults({ assets: [], licenses: [], vendors: [], tags: [] });
      setTotal(0);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced live search
  useEffect(() => {
    if (!isOpen) return;
    const term = searchTerm.trim();
    if (term.length === 0) {
      setResults({ assets: [], licenses: [], vendors: [], tags: [] });
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/search?q=${encodeURIComponent(term)}`);
        const searchData = res?.data || res;
        setResults(searchData?.results || { assets: [], licenses: [], vendors: [], tags: [] });
        setTotal(searchData?.total ?? 0);
        setSelectedIndex(0);
      } catch {
        setResults({ assets: [], licenses: [], vendors: [], tags: [] });
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [searchTerm, isOpen]);

  // Flattened array for keyboard navigation
  const flatItems = useMemo<SearchResultItem[]>(
    () => [
      ...(results?.assets || []),
      ...(results?.licenses || []),
      ...(results?.vendors || []),
      ...(results?.tags || []),
    ],
    [results]
  );

  // Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          navigate(flatItems[selectedIndex].url);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  let currentIndexTracker = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] z-10">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          {loading ? (
            <Loader2 className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assets, licenses, vendors, tags... (or type 'help')"
            className="flex-1 bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          {searchTerm.trim().length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm">Type anything to query workspace entities across PostgreSQL 16.</p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Assets</span>
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Licenses</span>
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Vendors</span>
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Tags</span>
              </div>
            </div>
          ) : total === 0 && !loading ? (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">No results found for "{searchTerm}"</p>
              <p className="text-xs text-slate-400 mt-1">Try another keyword, license code, or vendor name.</p>
            </div>
          ) : (
            <>
              {/* Assets Section */}
              {results.assets.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Digital Assets ({results.assets.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.assets.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            navigate(item.url);
                            onClose();
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.status && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.status}
                              </span>
                            )}
                            <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Licenses Section */}
              {results.licenses.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Software Licenses ({results.licenses.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.licenses.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            navigate(item.url);
                            onClose();
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <KeyRound className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vendors Section */}
              {results.vendors.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Vendors ({results.vendors.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {results.vendors.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            navigate(item.url);
                            onClose();
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {results.tags.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Tags ({results.tags.length})
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 px-3">
                    {results.tags.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <span
                          key={item.id}
                          onClick={() => {
                            navigate(item.url);
                            onClose();
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <TagIcon className="w-3 h-3" />
                          {item.title}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              Open
            </span>
          </div>
          <span>AssetVault Trigram Search Engine</span>
        </div>
      </div>
    </div>
  );
};
