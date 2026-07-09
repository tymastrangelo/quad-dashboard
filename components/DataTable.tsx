"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IoArrowDown, IoArrowUp, IoDownloadOutline, IoSearchOutline } from "react-icons/io5";
import { downloadCsv } from "@/lib/csv";
import { Button, EmptyState } from "@/components/ui";

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  csvValue?: (row: T) => string | number | null | undefined;
  align?: "right";
};

// Client-side searchable/sortable/paginated table for datasets that fit in
// memory (clubs ~300, events ~60). Server-paginated lists (users) pass their
// own controls and skip search/sort here.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchable,
  searchFn,
  pageSize = 25,
  csvName,
  onRowClick,
  emptyText = "Nothing here yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  searchable?: boolean;
  searchFn?: (row: T, q: string) => boolean;
  pageSize?: number;
  csvName?: string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q && searchFn ? rows.filter((r) => searchFn(r, q)) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchFn]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div>
      {(searchable || csvName) && (
        <div className="mb-3 flex items-center gap-2">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search…"
                className="h-9 w-full rounded-lg border border-transparent bg-field pl-9 pr-3 text-sm outline-none transition focus:border-maroon/40 focus:bg-card focus:ring-2 focus:ring-maroon/30"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-muted">
            {filtered.length.toLocaleString()} row{filtered.length === 1 ? "" : "s"}
          </span>
          {csvName && (
            <Button
              onClick={() =>
                downloadCsv(
                  csvName,
                  filtered,
                  columns
                    .filter((c) => c.csvValue)
                    .map((c) => ({ label: c.label, value: c.csvValue! }))
                )
              }
            >
              <IoDownloadOutline /> CSV
            </Button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.sortValue ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-ink"
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key
                            ? s.dir === -1
                              ? { key: c.key, dir: 1 }
                              : null
                            : { key: c.key, dir: -1 }
                        )
                      }
                    >
                      {c.label}
                      {sort?.key === c.key &&
                        (sort.dir === -1 ? <IoArrowDown size={11} /> : <IoArrowUp size={11} />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-hairline/60 last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-card-alt" : ""
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text={emptyText} />}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-subtle">
          <Button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </Button>
          <span>
            Page {safePage + 1} of {pages}
          </span>
          <Button disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
