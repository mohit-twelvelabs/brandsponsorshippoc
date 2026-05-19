import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, X, Plus, CheckCircle2 } from 'lucide-react';
import { useAccounts } from '../lib/AccountContext';
import { getRecentBrands } from '../lib/accountStorage';

export interface BrandSearchProps {
  onBrandsSelect: (brands: string[]) => void;
  onNext: () => void;
  isLoading?: boolean;
}

interface BrandSuggestion {
  name: string;
  description: string;
  category: string;
}

const BrandSearch: React.FC<BrandSearchProps> = ({
  onBrandsSelect,
  onNext,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [_inputFocused, setInputFocused] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { activeAccount } = useAccounts();
  const recent = useMemo(
    () => getRecentBrands(activeAccount?.id ?? null),
    [activeAccount?.id],
  );

  const handlePasteAdd = useCallback(() => {
    const tokens = pasteText
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      setPasteOpen(false);
      setPasteText('');
      return;
    }
    const existing = new Set(selectedBrands.map(b => b.toLowerCase()));
    const additions = tokens.filter(t => !existing.has(t.toLowerCase()));
    if (additions.length > 0) {
      const next = [...selectedBrands, ...additions];
      setSelectedBrands(next);
      onBrandsSelect(next);
    }
    setPasteText('');
    setPasteOpen(false);
  }, [pasteText, selectedBrands, onBrandsSelect]);

  // Popular brand suggestions for quick selection
  const popularBrands: BrandSuggestion[] = [
    { name: 'Nike', description: 'Sportswear and athletic equipment', category: 'Sports' },
    { name: 'Adidas', description: 'Sports clothing and accessories', category: 'Sports' },
    { name: 'Coca-Cola', description: 'Beverage and refreshment brand', category: 'Beverage' },
    { name: 'Pepsi', description: 'Beverage and snack brand', category: 'Beverage' },
    { name: 'Ford', description: 'Automotive manufacturer', category: 'Automotive' },
    { name: 'Toyota', description: 'Automotive manufacturer', category: 'Automotive' },
    { name: 'Honda', description: 'Automotive and equipment manufacturer', category: 'Automotive' },
    { name: 'McDonald\'s', description: 'Fast food restaurant chain', category: 'Food' },
    { name: 'Samsung', description: 'Electronics and technology', category: 'Technology' },
    { name: 'Apple', description: 'Consumer electronics', category: 'Technology' },
    { name: 'Microsoft', description: 'Software and technology', category: 'Technology' },
    { name: 'Amazon', description: 'E-commerce and cloud services', category: 'Technology' },
    { name: 'Red Bull', description: 'Energy drink and sports marketing', category: 'Beverage' },
    { name: 'Under Armour', description: 'Athletic clothing and gear', category: 'Sports' },
    { name: 'Puma', description: 'Sports clothing and footwear', category: 'Sports' },
    { name: 'FedEx', description: 'Shipping and logistics', category: 'Logistics' },
    { name: 'UPS', description: 'Package delivery and logistics', category: 'Logistics' },
    { name: 'Visa', description: 'Payment processing', category: 'Financial' },
    { name: 'Mastercard', description: 'Payment processing', category: 'Financial' },
    { name: 'American Express', description: 'Financial services', category: 'Financial' }
  ];

  // Filter suggestions based on search query
  const filterSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      return popularBrands.slice(0, 8); // Show popular brands when no query
    }

    const lowercaseQuery = query.toLowerCase();
    return popularBrands.filter(brand =>
      brand.name.toLowerCase().includes(lowercaseQuery) ||
      brand.description.toLowerCase().includes(lowercaseQuery) ||
      brand.category.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10);
  }, []);

  // Handle search input change with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      const filteredSuggestions = filterSuggestions(value);
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    }, 300);
  }, [filterSuggestions]);

  // Handle brand selection
  const handleBrandSelect = useCallback((brandName: string) => {
    if (!selectedBrands.includes(brandName)) {
      const newBrands = [...selectedBrands, brandName];
      setSelectedBrands(newBrands);
      onBrandsSelect(newBrands);
    }
    setSearchQuery('');
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  }, [selectedBrands, onBrandsSelect]);

  // Handle brand removal
  const handleBrandRemove = useCallback((brandName: string) => {
    const newBrands = selectedBrands.filter(brand => brand !== brandName);
    setSelectedBrands(newBrands);
    onBrandsSelect(newBrands);
  }, [selectedBrands, onBrandsSelect]);

  // Handle adding custom brand from search input
  const handleAddCustomBrand = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery && !selectedBrands.includes(trimmedQuery)) {
      const newBrands = [...selectedBrands, trimmedQuery];
      setSelectedBrands(newBrands);
      onBrandsSelect(newBrands);
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [searchQuery, selectedBrands, onBrandsSelect]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    const filteredSuggestions = filterSuggestions(searchQuery);
    setSuggestions(filteredSuggestions);
    setShowSuggestions(true);
  }, [searchQuery, filterSuggestions]);

  // Handle input blur (with delay to allow suggestion clicks)
  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  }, []);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery.trim()) {
        handleAddCustomBrand();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    }
  }, [searchQuery, handleAddCustomBrand]);

  // Initialize suggestions on mount
  useEffect(() => {
    setSuggestions(filterSuggestions(''));
  }, [filterSuggestions]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md w-full">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
          STEP 2 · BRANDS
        </p>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.05] mb-3">
          Which brands are you tracking?
        </h1>
        <p className="text-base lg:text-lg text-text-secondary max-w-2xl">
          Add brands one at a time, paste a list, or replay a recent set.
        </p>
      </div>

      {/* Recent brand sets */}
      {recent.length > 0 && selectedBrands.length === 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary mb-3">
            Recent brand sets
          </p>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-4">
            <p className="text-sm text-text-secondary truncate flex-1">
              {recent.join(', ')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedBrands(recent);
                onBrandsSelect(recent);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium hover:border-mb-green-dark transition-colors flex-shrink-0"
            >
              Replay
            </button>
          </div>
        </div>
      )}

      {/* Search input row */}
      <div className="relative mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyPress}
              placeholder="Search for brands (e.g., Nike, Ford, Coca-Cola)..."
              disabled={isLoading}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-card text-foreground text-base placeholder:text-text-tertiary focus:outline-none focus:border-mb-green-dark focus:ring-2 focus:ring-mb-green/30 transition disabled:opacity-50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSuggestions(false);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-text-tertiary hover:text-foreground hover:bg-card transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Add Brand button */}
          <button
            type="button"
            onClick={handleAddCustomBrand}
            disabled={!searchQuery.trim() || isLoading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mb-green text-brand-charcoal font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Brand
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-md max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.name}-${index}`}
                type="button"
                onClick={() => handleBrandSelect(suggestion.name)}
                disabled={selectedBrands.includes(suggestion.name) || isLoading}
                className={`w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors border-b border-border-light last:border-b-0 ${
                  selectedBrands.includes(suggestion.name)
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {suggestion.name}
                      </span>
                      {selectedBrands.includes(suggestion.name) && (
                        <CheckCircle2 className="w-4 h-4 text-mb-green-dark" />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">
                      {suggestion.description}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium ml-3">
                    {suggestion.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected brands + toolbar */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            Selected Brands ({selectedBrands.length})
          </span>
          <div className="flex items-center gap-1">
            {!pasteOpen && (
              <button
                type="button"
                onClick={() => setPasteOpen(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium disabled:opacity-50"
              >
                Paste list
              </button>
            )}
            <button
              type="button"
              onClick={() => { setSelectedBrands([]); onBrandsSelect([]); }}
              disabled={isLoading || selectedBrands.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Paste panel */}
        {pasteOpen && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-mb-green-dark focus:ring-2 focus:ring-mb-green/30 transition text-sm font-mono"
              rows={3}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Nike, Adidas\nFord\nCoca-Cola"}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPasteText(''); setPasteOpen(false); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasteAdd}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mb-green text-brand-charcoal font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Selected brand chips */}
        {selectedBrands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedBrands.map((brand) => (
              <span
                key={brand}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-mb-green bg-mb-green-light/40 text-brand-charcoal text-sm font-semibold"
              >
                {brand}
                <button
                  type="button"
                  onClick={() => handleBrandRemove(brand)}
                  disabled={isLoading}
                  aria-label={`Remove ${brand}`}
                  className="ml-0.5 rounded-full hover:bg-mb-green/30 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            No brands selected yet. Search above or paste a list.
          </p>
        )}
      </div>

      {/* Continue CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={selectedBrands.length === 0 || isLoading}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-mb-green text-brand-charcoal text-base font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Continue to Video Selection'}
        </button>
      </div>
    </div>
  );
};

export default BrandSearch;
