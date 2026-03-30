import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

const DATA_TABLE_VIRTUAL_MIN = 28
const DATA_TABLE_ROW_EST = 52

/**
 * Virtualized body: grid layout (avoids table+absolute row layout issues).
 */
function DataTableVirtualBody({ table, columns, scrollRef }) {
  const rows = table.getRowModel().rows
  const headerGroups = table.getHeaderGroups()
  const gridCols = columns.length

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => DATA_TABLE_ROW_EST,
    overscan: 10,
  })

  return (
    <div ref={scrollRef} className="max-h-[min(65vh,520px)] overflow-auto rounded-md border">
      <div
        className="sticky top-0 z-[1] grid gap-0 border-b bg-card text-sm font-medium"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))` }}
      >
        {headerGroups.map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div key={header.id} className="flex h-11 items-center border-b border-border px-3">
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          ))
        )}
      </div>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index]
          return (
            <div
              key={row.id}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              className="absolute left-0 grid w-full border-b border-border text-sm hover:bg-muted/50"
              style={{
                transform: `translateY(${vi.start}px)`,
                gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))`,
                height: `${vi.size}px`,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className="flex min-w-0 items-center px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * @param {boolean} [virtualize] — When true, disables client pagination and window-rows large filtered result sets.
 */
export function DataTable({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  emptyDescription = "No results.",
  emptyImage,
  virtualize = false,
}) {
  const [sorting, setSorting] = React.useState([])
  const [columnFilters, setColumnFilters] = React.useState([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const scrollRef = React.useRef(null)

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    ...(virtualize ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  const rows = table.getRowModel().rows
  const useVirtual =
    virtualize && rows.length >= DATA_TABLE_VIRTUAL_MIN

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="flex items-center py-4">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="max-w-sm"
          />
        </div>
      )}
      {useVirtual ? (
        rows.length ? (
          <DataTableVirtualBody
            table={table}
            columns={columns}
            scrollRef={scrollRef}
          />
        ) : (
          <div className="rounded-md border p-8">
            <Empty description={emptyDescription} image={emptyImage} />
          </div>
        )
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows?.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <Empty description={emptyDescription} image={emptyImage} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {!virtualize && (
        <div className={cn("flex items-center justify-end space-x-2")}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
