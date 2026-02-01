"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  className?: string;
  sortKey?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDirection?: SortDirection;
}

function getSortValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, prop) => {
    if (current && typeof current === "object" && prop in current) {
      return (current as Record<string, unknown>)[prop];
    }
    return undefined;
  }, obj);
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage,
  defaultSortKey,
  defaultSortDirection = "asc",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const handleSort = (key: string | undefined) => {
    if (!key) return;

    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !data.length) return data;

    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // Numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === "asc" ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  if (!data.length) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <p>{emptyMessage || "No data found."}</p>
      </div>
    );
  }

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable || !column.sortKey) return null;

    if (sortKey !== column.sortKey) {
      return <ArrowUpDown className="h-4 w-4 ml-2 inline opacity-40" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-2 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-2 inline" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead
                key={idx}
                className={`${col.className || ""} ${col.sortable ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
                onClick={() => col.sortable && handleSort(col.sortKey)}
              >
                <div className="flex items-center">
                  {col.header}
                  {getSortIcon(col)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col, colIndex) => (
                <TableCell key={colIndex} className={col.className}>
                  {col.accessor(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
