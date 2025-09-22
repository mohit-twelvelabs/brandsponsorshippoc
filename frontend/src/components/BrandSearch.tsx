import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Plus, Building2, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Text } from './ui/Text';
import { Input } from './ui/Input';

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
  const [inputFocused, setInputFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    <Card className="w-full p-6">
      <Card.Header className="p-0 mb-6">
        <Card.Title className="flex items-center">
          <Building2 className="w-6 h-6 mr-2 text-primary" />
          Select Brands to Analyze
        </Card.Title>
        <Text as="p" className="text-muted-foreground mt-2">
          Search for and select the specific brands you want to analyze for sponsorship ROI in your video.
        </Text>
      </Card.Header>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyPress}
            placeholder="Search for brands (e.g., Nike, Ford, Coca-Cola)..."
            className="pl-10 pr-12"
            disabled={isLoading}
          />
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setShowSuggestions(false);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-6 w-6 z-10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Add Custom Brand Button */}
        {searchQuery.trim() && !suggestions.some(s => s.name.toLowerCase() === searchQuery.toLowerCase()) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCustomBrand}
            className="mt-2 text-xs"
            disabled={isLoading}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add "{searchQuery.trim()}" as custom brand
          </Button>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.name}-${index}`}
                onClick={() => handleBrandSelect(suggestion.name)}
                disabled={selectedBrands.includes(suggestion.name) || isLoading}
                className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-b-0 ${
                  selectedBrands.includes(suggestion.name) 
                    ? 'bg-accent/50 opacity-60 cursor-not-allowed' 
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Text as="p" className="font-medium">
                        {suggestion.name}
                      </Text>
                      {selectedBrands.includes(suggestion.name) && (
                        <CheckCircle2 className="w-4 h-4 ml-2 text-primary" />
                      )}
                    </div>
                    <Text as="p" className="text-xs text-muted-foreground mt-1">
                      {suggestion.description}
                    </Text>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {suggestion.category}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Brands */}
      {selectedBrands.length > 0 && (
        <div className="mb-6">
          <Text as="h3" className="text-sm font-medium mb-3">
            Selected Brands ({selectedBrands.length})
          </Text>
          <div className="flex flex-wrap gap-2">
            {selectedBrands.map((brand) => (
              <Badge
                key={brand}
                variant="default"
                className="px-3 py-1.5 text-sm flex items-center"
              >
                {brand}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBrandRemove(brand)}
                  className="ml-2 p-0 h-4 w-4 hover:bg-destructive/20"
                  disabled={isLoading}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Text as="p" className="text-sm text-muted-foreground">
          {selectedBrands.length === 0 
            ? 'Select at least one brand to continue' 
            : `${selectedBrands.length} brand${selectedBrands.length > 1 ? 's' : ''} selected`
          }
        </Text>
        
        <Button
          onClick={onNext}
          disabled={selectedBrands.length === 0 || isLoading}
          className="px-6"
        >
          {isLoading ? 'Loading...' : 'Continue to Video Selection'}
        </Button>
      </div>
    </Card>
  );
};

export default BrandSearch;
