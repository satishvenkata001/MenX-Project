import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Palette, AlertCircle, RefreshCw } from 'lucide-react';

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';
  let clean = hex.trim().toUpperCase();
  if (!clean.startsWith('#')) {
    clean = `#${clean}`;
  }
  if (clean.length === 4) {
    clean = `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

export function isValidHex(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const trimmed = hex.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_REGEX.test(withHash);
}

const POPULAR_PRESETS = [
  { name: 'Maroon', hex: '#800000' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Royal Blue', hex: '#4169E1' },
  { name: 'Coffee Brown', hex: '#4B3621' },
  { name: 'Mustard', hex: '#FFDB58' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Mint Green', hex: '#98FF98' },
];

/**
 * HybridColorSelector Component
 * 
 * Provides quick selection among existing product colors or interactive custom color creation.
 * Fully keyboard accessible, mobile responsive, and matches MENX Admin design language.
 */
export default function HybridColorSelector({
  value,
  onChange,
  colors = [],
  onAddCustomColor,
  disabled = false,
  className = '',
  required = false,
  id = 'variant-color-selector'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom color form state
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#800000');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const customNameInputRef = useRef(null);
  const colorPickerInputRef = useRef(null);

  // Find currently selected color
  const selectedColor = useMemo(() => {
    return colors.find(c => c.id === value) || null;
  }, [colors, value]);

  // Filter existing colors by search query
  const filteredColors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return colors;
    return colors.filter(c => c.name.toLowerCase().includes(query));
  }, [colors, searchQuery]);

  // Focus appropriate input when opening or switching modes
  useEffect(() => {
    if (isOpen) {
      if (isCustomMode) {
        setTimeout(() => customNameInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, isCustomMode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsCustomMode(false);
        setSearchQuery('');
        setErrorMessage('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        if (isCustomMode) {
          setIsCustomMode(false);
          setErrorMessage('');
        } else {
          setIsOpen(false);
          setSearchQuery('');
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isCustomMode]);

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setIsCustomMode(false);
      setSearchQuery('');
      setErrorMessage('');
    }
  };

  const handleSelectColor = (color) => {
    if (onChange) {
      onChange(color.id, color);
    }
    setIsOpen(false);
    setIsCustomMode(false);
    setSearchQuery('');
    setErrorMessage('');
  };

  const handleOpenCustomModeWithPrefill = (name = '') => {
    setCustomName(name);
    setCustomHex(normalizeHex(customHex || '#800000'));
    setIsCustomMode(true);
    setErrorMessage('');
  };

  const handleHexInputChange = (e) => {
    let val = e.target.value.trim().toUpperCase();
    if (val && !val.startsWith('#')) {
      val = `#${val}`;
    }
    setCustomHex(val);
    setErrorMessage('');
  };

  const handlePickerChange = (e) => {
    const hex = e.target.value.toUpperCase();
    setCustomHex(hex);
    setErrorMessage('');
  };

  const handleAddCustomColorSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedName = customName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setErrorMessage('Please enter a color name.');
      return;
    }
    if (trimmedName.length > 50) {
      setErrorMessage('Color name must be 50 characters or less.');
      return;
    }

    const formattedHex = customHex.startsWith('#') ? customHex : `#${customHex}`;
    if (!isValidHex(formattedHex)) {
      setErrorMessage('Please enter a valid HEX color (e.g. #800000 or #FFF).');
      return;
    }

    const normalizedHex = normalizeHex(formattedHex);

    setIsAdding(true);
    setErrorMessage('');

    try {
      if (onAddCustomColor) {
        const resultColor = await onAddCustomColor({
          name: trimmedName,
          hexCode: normalizedHex
        });

        if (resultColor && resultColor.id) {
          if (onChange) {
            onChange(resultColor.id, resultColor);
          }
        }
      }
      setIsOpen(false);
      setIsCustomMode(false);
      setSearchQuery('');
      setCustomName('');
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to save custom color';
      setErrorMessage(msg);
    } finally {
      setIsAdding(false);
    }
  };

  // Safe preview hex
  const previewHex = isValidHex(customHex) ? normalizeHex(customHex) : '#800000';

  return (
    <div ref={containerRef} className={`relative select-none text-xs ${className}`}>
      {/* 1. Closed state / Trigger Button */}
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleOpenDropdown}
        className={`w-full min-h-[42px] px-3 py-2 bg-menx-surface border rounded-lg text-left flex items-center justify-between transition-all duration-150 ${
          isOpen
            ? 'border-menx-primary ring-1 ring-menx-primary/40 shadow-lg shadow-black/40'
            : 'border-menx-border hover:border-menx-border/80'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
          {selectedColor ? (
            <>
              <span
                className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-inner"
                style={{ backgroundColor: selectedColor.hex_code }}
                aria-hidden="true"
              />
              <span className="font-bold text-white truncate text-xs">
                {selectedColor.name}
              </span>
            </>
          ) : (
            <>
              <span className="w-4 h-4 rounded-full border border-dashed border-menx-text-muted/40 shrink-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-menx-text-muted/40" />
              </span>
              <span className="text-menx-text-muted font-normal truncate text-xs">
                {colors.length === 0 ? 'No colors configured' : 'Select color shade...'}
              </span>
            </>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-menx-text-muted shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-menx-primary' : ''
          }`}
        />
      </button>

      {/* Hidden real input for required form validation if needed */}
      {required && (
        <input
          type="text"
          value={value || ''}
          required
          onChange={() => {}}
          tabIndex={-1}
          className="sr-only"
        />
      )}

      {/* 2. Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 bg-[#121820] border border-menx-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 max-w-full"
          style={{ minWidth: '280px' }}
        >
          {!isCustomMode ? (
            /* VIEW A: Search & Existing Colors List */
            <div className="flex flex-col max-h-[340px]">
              {/* Search Bar */}
              <div className="p-2 border-b border-menx-border/80 bg-menx-surface/50">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search or type color..."
                    className="w-full bg-menx-surface border border-menx-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-menx-text-muted focus:outline-none focus:border-menx-primary/80 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-menx-text-muted hover:text-white p-0.5 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Section Header */}
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-menx-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>Existing Colors</span>
                <span className="text-[9px] text-menx-text-muted/70 font-normal">
                  {filteredColors.length} {filteredColors.length === 1 ? 'shade' : 'shades'}
                </span>
              </div>

              {/* Colors Grid / List */}
              <div className="p-2 overflow-y-auto max-h-48 space-y-1 scrollbar-thin">
                {filteredColors.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredColors.map((c) => {
                      const isSelected = c.id === value;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectColor(c)}
                          className={`w-full px-2.5 py-2 rounded-lg border text-left flex items-center justify-between transition-all duration-150 group cursor-pointer ${
                            isSelected
                              ? 'bg-menx-primary/15 border-menx-primary text-white font-bold shadow-sm shadow-menx-primary/10'
                              : 'bg-menx-surface/80 border-transparent hover:border-menx-border hover:bg-menx-surface-elevated text-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-inner"
                              style={{ backgroundColor: c.hex_code }}
                            />
                            <span className="truncate text-xs leading-none">
                              {c.name}
                            </span>
                          </div>

                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-menx-primary shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 px-2 text-center space-y-2">
                    <p className="text-xs text-menx-text-muted">
                      No existing color found for "{searchQuery}"
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomModeWithPrefill(searchQuery.trim())}
                      className="inline-flex items-center space-x-1.5 py-1.5 px-3 bg-menx-primary/10 hover:bg-menx-primary/20 text-menx-primary border border-menx-primary/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create "{searchQuery.trim()}"</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom: Choose Custom Color Action */}
              <div className="p-2 border-t border-menx-border/80 bg-menx-surface/40">
                <button
                  type="button"
                  onClick={() => handleOpenCustomModeWithPrefill(searchQuery.trim())}
                  className="w-full py-2 px-3 bg-menx-surface hover:bg-menx-surface-elevated border border-dashed border-menx-border hover:border-menx-primary/50 text-menx-primary hover:text-menx-primary-hover rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-all duration-150 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose Custom Color</span>
                </button>
              </div>
            </div>
          ) : (
            /* VIEW B: Compact Custom Color Form */
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-menx-border/80 pb-2">
                <div className="flex items-center space-x-1.5 text-white font-bold text-xs">
                  <Palette className="w-3.5 h-3.5 text-menx-primary" />
                  <span>Add Custom Color Shade</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(false);
                    setErrorMessage('');
                  }}
                  className="text-menx-text-muted hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-1.5 text-menx-error text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Color Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-menx-text-muted font-bold block uppercase tracking-wider">
                  Color Name *
                </label>
                <input
                  ref={customNameInputRef}
                  type="text"
                  maxLength={50}
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="e.g. Maroon, Emerald, Dusty Rose"
                  className="w-full bg-menx-surface border border-menx-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-menx-text-muted/60 focus:outline-none focus:border-menx-primary transition-colors"
                />
              </div>

              {/* Pick Color & Hex */}
              <div className="space-y-1">
                <label className="text-[10px] text-menx-text-muted font-bold block uppercase tracking-wider">
                  Pick Color (HEX) *
                </label>

                <div className="flex items-center space-x-2">
                  {/* Swatch with interactive hidden color picker */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => colorPickerInputRef.current?.click()}
                      className="w-8 h-8 rounded-lg border border-white/20 shadow-inner flex items-center justify-center relative overflow-hidden group cursor-pointer"
                      style={{ backgroundColor: previewHex }}
                      title="Click to open color palette"
                    >
                      <Palette className="w-3.5 h-3.5 text-white/70 drop-shadow group-hover:scale-110 transition-transform" />
                    </button>
                    <input
                      ref={colorPickerInputRef}
                      type="color"
                      value={previewHex}
                      onChange={handlePickerChange}
                      className="absolute inset-0 opacity-0 pointer-events-none w-full h-full cursor-pointer"
                    />
                  </div>

                  {/* HEX text input */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={7}
                      value={customHex}
                      onChange={handleHexInputChange}
                      placeholder="#800000"
                      className={`w-full bg-menx-surface border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold tracking-wider text-white focus:outline-none transition-colors ${
                        isValidHex(customHex)
                          ? 'border-menx-border focus:border-menx-primary'
                          : 'border-red-500/50 focus:border-red-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Preset Swatches */}
              <div className="space-y-1 pt-1">
                <span className="text-[9px] text-menx-text-muted font-semibold block uppercase tracking-wider">
                  Quick Palette Suggestions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_PRESETS.map(preset => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => {
                        setCustomHex(preset.hex);
                        if (!customName.trim()) {
                          setCustomName(preset.name);
                        }
                        setErrorMessage('');
                      }}
                      className="w-5 h-5 rounded-md border border-white/20 hover:scale-110 transition-transform shadow-sm relative group cursor-pointer"
                      style={{ backgroundColor: preset.hex }}
                      title={`${preset.name} (${preset.hex})`}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center space-x-2 border-t border-menx-border/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(false);
                    setErrorMessage('');
                  }}
                  disabled={isAdding}
                  className="w-1/2 py-2 border border-menx-border hover:bg-menx-surface-elevated text-menx-text-secondary hover:text-white rounded-lg text-xs font-bold transition-colors text-center cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomColorSubmit}
                  disabled={isAdding || !customName.trim() || !isValidHex(customHex)}
                  className="w-1/2 py-2 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add Color</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
