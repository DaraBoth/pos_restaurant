import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    label: string;
    value: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = "Select an option", className = "", disabled = false }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => {
                    if (disabled) return;
                    setIsOpen(!isOpen);
                }}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--foreground)] outline-none transition-all shadow-sm ${disabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'focus:border-[var(--accent-blue)] cursor-pointer hover:brightness-105'
                }`}
            >
                <span className={selectedOption ? '' : 'text-[var(--text-secondary)] opacity-70'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-[120] w-full mt-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto p-1.5 no-scrollbar">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                                    value === option.value
                                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-black'
                                        : 'text-[var(--foreground)] font-semibold hover:bg-[var(--bg-card)] hover:text-[var(--foreground)]'
                                }`}
                            >
                                {option.label}
                                {value === option.value && <Check size={14} className="text-[var(--accent-blue)]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
