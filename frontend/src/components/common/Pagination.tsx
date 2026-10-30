import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationMeta } from '../../types';

interface PaginationProps {
  meta?: PaginationMeta;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
  onPageSizeChange?: (newLimit: number) => void;
  limitOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  meta,
  currentPage = 1,
  totalPages: propTotalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onLimitChange,
  onPageSizeChange,
  limitOptions = [10, 25, 50, 100],
  className = '',
}) => {
  const page = meta?.page ?? currentPage;
  const limit = meta?.limit ?? pageSize;
  const total = meta?.total ?? totalItems;
  const totalPages = meta?.totalPages ?? propTotalPages;
  const hasNext = meta?.hasNext ?? page < totalPages;
  const hasPrev = meta?.hasPrev ?? page > 1;
  const handleLimitChange = onLimitChange || onPageSizeChange;

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-[#0b1120] border-t border-white/[0.06] text-xs text-slate-400 ${className}`}
    >
      {/* Left: Summary and limit selector */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          Showing <span className="font-semibold text-slate-200">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-200">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-200">{total}</span>
        </span>

        {handleLimitChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden sm:inline text-slate-500">Rows:</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="py-1 px-2 bg-[#030712] border border-white/[0.08] rounded-md text-slate-200 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev || page === 1}
          aria-label="First page"
          className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] text-slate-400 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] text-slate-400 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-2.5 py-1 font-medium text-slate-300">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
          className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] text-slate-400 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext || page === totalPages}
          aria-label="Last page"
          className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] text-slate-400 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
