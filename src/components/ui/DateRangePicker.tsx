'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
    startDate: Date;
    endDate: Date;
    onChange: (range: { from: Date; to: Date }) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const range: DateRange = {
        from: startDate,
        to: endDate
    };

    const handleSelect = (newRange: DateRange | undefined) => {
        if (newRange?.from && newRange?.to) {
            onChange({ from: newRange.from, to: newRange.to });
            // Don't auto-close if selecting a range, usually better to let user confirm or click outside
        } else if (newRange?.from) {
            // If only 'from' is selected, wait for 'to'
            onChange({ from: newRange.from, to: newRange.from });
        }
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayDate = range.from && range.to 
        ? `${format(range.from, 'dd MMM yyyy')} - ${format(range.to, 'dd MMM yyyy')}`
        : 'Select date range';

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pos-input flex items-center gap-3 min-w-[280px] cursor-pointer hover:border-[var(--accent-blue)] transition-all bg-[var(--bg-elevated)]"
            >
                <CalendarIcon size={16} className="text-[var(--accent-blue)]" />
                <span className="flex-1 text-left font-medium text-[var(--foreground)]">
                    {displayDate}
                </span>
                <ChevronLeft size={14} className={`transform transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 animate-fade-in">
                    <div className="pos-card p-4 shadow-2xl bg-[var(--bg-card)] border-[var(--border)]">
                        <style dangerouslySetInnerHTML={{ __html: `
                            .rdp {
                                --rdp-cell-size: 40px;
                                --rdp-accent-color: var(--accent);
                                --rdp-background-color: var(--bg-elevated);
                                margin: 0;
                                font-family: inherit;
                                color: var(--foreground);
                            }
                            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
                                background-color: var(--accent) !important;
                                color: #fff !important;
                            }
                            .rdp-day_range_middle {
                                background-color: rgba(34, 197, 94, 0.1) !important;
                                color: var(--accent) !important;
                            }
                            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                                background-color: var(--bg-elevated) !important;
                                color: var(--accent-blue) !important;
                            }
                            .rdp-nav_button {
                                color: var(--text-secondary);
                            }
                            .rdp-head_cell {
                                color: var(--text-secondary);
                                font-size: 0.75rem;
                                font-weight: 700;
                                text-transform: uppercase;
                            }
                            .rdp-caption_label {
                                font-weight: 800;
                                font-size: 0.9rem;
                                color: var(--foreground);
                            }
                        `}} />
                        <DayPicker
                            mode="range"
                            selected={range}
                            onSelect={handleSelect}
                            numberOfMonths={1}
                            initialFocus
                        />
                        <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end">
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--accent-blue)] hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
