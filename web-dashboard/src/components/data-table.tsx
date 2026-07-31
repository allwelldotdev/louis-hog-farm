'use client'

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The operational tables' shared shell: client sorting, column visibility and
 * paging over a set already fetched.
 *
 * This is where `@tanstack/react-table` finally earns its place. The dashboard's
 * leaderboard is ten server-ranked rows and stayed a plain `<table>`; a herd
 * roster is hundreds of rows people want to re-sort by any column, which is the
 * problem the library exists for.
 *
 * Sorting and paging are deliberately client-side. The rows are already in
 * memory, so a column click is instant and costs no request — and the server
 * facets are what reduce the set in the first place.
 */

const PAGE_SIZES = [25, 50, 100] as const

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Filters and actions belonging to this table, rendered left of the column menu. */
  toolbar?: React.ReactNode
  /** Sorted on first render — the column id and whether it starts descending. */
  initialSort?: SortingState
  /** Columns switched off until someone asks for them in the Columns menu. */
  initialVisibility?: VisibilityState
  emptyMessage?: string
  /** Stable row key, so React does not reuse a row's DOM for a different animal. */
  getRowId: (row: TData) => string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbar,
  initialSort = [],
  initialVisibility = {},
  emptyMessage = 'Nothing to show.',
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility)

  // React Compiler declines to memoize any component holding a table instance,
  // because `useReactTable` hands back functions whose results change without a
  // new identity. That is the safe outcome, not a defect — this component
  // re-renders on its own state and there is nothing here worth memoizing — but
  // left unsuppressed it prints on every `make check` and teaches people to
  // scroll past warnings.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    getRowId,
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const firstRow = data.length === 0 ? 0 : pageIndex * pageSize + 1
  const lastRow = Math.min((pageIndex + 1) * pageSize, data.length)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">{toolbar}</div>
        <ColumnMenu table={table} />
      </div>

      <div className="overflow-x-auto rounded-card border border-rule">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-rule text-left">
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : sortable
                              ? 'none'
                              : undefined
                      }
                      className="px-4 py-2.5"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="eyebrow flex items-center gap-1.5 font-semibold transition-colors hover:text-ink"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp aria-hidden className="size-3 text-ochre" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown aria-hidden className="size-3 text-ochre" />
                          ) : (
                            <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <span className="eyebrow font-semibold">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-rule/60 last:border-0 hover:bg-raised/60">
                {row.getVisibleCells().map((cell) => (
                  // The container scrolls; cells do not wrap. A tag number or a
                  // date broken across two lines is unreadable, and these
                  // tables are mostly short values in many columns.
                  <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{emptyMessage}</p>
        ) : null}
      </div>

      {data.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <p>
            <span className="figure text-ink">
              {firstRow}–{lastRow}
            </span>{' '}
            of <span className="figure text-ink">{data.length}</span>
          </p>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Rows
              <select
                className="h-8 rounded-control border border-rule bg-raised px-2 text-xs text-ink"
                value={pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="figure text-ink">
              {pageIndex + 1} / {Math.max(pageCount, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Column visibility as a native `<details>` disclosure.
 *
 * No dropdown primitive is installed and this needs none: `<details>`/`<summary>`
 * is focusable, toggles on Enter and Space, and is announced as expandable by
 * every screen reader without a line of JavaScript.
 */
function ColumnMenu<TData>({ table }: { table: Table<TData> }) {
  const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide())
  if (hideable.length === 0) return null

  return (
    <details className="relative">
      <summary
        className={cn(
          'inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-control',
          'border border-rule px-3 text-sm text-ink transition-colors',
          'hover:border-rule-strong hover:bg-raised',
        )}
      >
        <Columns3 aria-hidden className="size-4" />
        Columns
      </summary>

      <div className="absolute right-0 z-10 mt-2 w-48 rounded-card border border-rule bg-surface p-2 shadow-lg shadow-black/40">
        {hideable.map((column) => (
          <label
            key={column.id}
            className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-raised"
          >
            <input
              type="checkbox"
              className="accent-ochre"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
          </label>
        ))}
      </div>
    </details>
  )
}
