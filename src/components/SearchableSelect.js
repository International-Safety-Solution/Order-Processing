'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '-- Select an option --',
  required = false,
  disabled = false,
  className = '',
  id
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (!value && value !== 0) return null;
    return options.find(o => String(o.id) === String(value)) || null;
  }, [options, value]);

  // Sync searchTerm with selectedOption whenever value or options change (when closed)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.name : '');
    }
  }, [selectedOption, isOpen]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm || !isOpen) return options;
    const query = searchTerm.toLowerCase().trim();
    return options.filter(o => (o.name || '').toLowerCase().includes(query));
  }, [options, searchTerm, isOpen]);

  // Close dropdown on click outside and revert invalid input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (isOpen) {
          // Revert search term to valid selected option name (enforce dropdown selection only)
          setSearchTerm(selectedOption ? selectedOption.name : '');
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedOption]);

  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    // Select all text in input on focus so user can immediately type to filter
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 50);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleSelectOption = (option) => {
    if (!option || option.id === '') {
      onChange('');
      setSearchTerm('');
    } else {
      onChange(option.id);
      setSearchTerm(option.name);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length === 1) {
        handleSelectOption(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchTerm(selectedOption ? selectedOption.name : '');
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden real input for native HTML form validation (e.g. required) */}
      <input
        type="text"
        tabIndex={-1}
        required={required}
        value={value || ''}
        onChange={() => {}}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Main Searchable Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          value={searchTerm}
          placeholder={placeholder}
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="block w-full px-3 py-2 pr-14 border border-zinc-200 rounded-lg text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all disabled:bg-zinc-100 disabled:cursor-not-allowed"
        />

        {/* Action icons on right: Clear (X) + Chevron */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setSearchTerm(selectedOption ? selectedOption.name : '');
                setIsOpen(false);
              } else {
                handleInputFocus();
              }
            }}
            className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg z-50 py-1 text-sm divide-y divide-zinc-50 animate-fade-in">
          {/* Default / Unselect option */}
          <div
            onMouseDown={() => handleSelectOption({ id: '', name: '' })}
            className={`px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-50 cursor-pointer flex items-center justify-between transition-colors ${
              !value ? 'bg-zinc-50 text-brand-orange font-bold' : ''
            }`}
          >
            <span>{placeholder}</span>
            {!value && <Check className="h-3.5 w-3.5 text-brand-orange" />}
          </div>

          {/* Filtered options */}
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-zinc-400 text-center">
              No matches found for &quot;<span className="text-zinc-600 font-medium">{searchTerm}</span>&quot;
            </div>
          ) : (
            filteredOptions.map((option, idx) => {
              const isSelected = String(option.id) === String(value);
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={option.id}
                  onMouseDown={() => handleSelectOption(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-orange-50/80 text-brand-orange font-semibold'
                      : isHighlighted
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <span className="truncate">{option.name}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-brand-orange shrink-0 ml-2" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

