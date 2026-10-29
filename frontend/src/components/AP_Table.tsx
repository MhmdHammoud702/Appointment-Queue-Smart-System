import { useState, type ReactNode } from "react";
import { AP_Button } from "./AP_Button";
import { AP_Empty } from "./AP_Empty";
import { AP_Error } from "./AP_Error";
import { AP_Loading } from "./AP_Loading";
import "./AP_Table.css";

export type AP_TableColumn<Row> = {
  label: string;
  render: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number;
};

type AP_TableProps<Row> = {
  columns: AP_TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  pageSize?: number;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function AP_Table<Row>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  emptyMessage = "There is nothing to show yet.",
  emptyActionLabel,
  onEmptyAction,
  loading = false,
  error,
  onRetry,
}: AP_TableProps<Row>) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
  const [page, setPage] = useState(1);

  const sortedRows = [...rows];

  if (sortColumn !== null) {
    const column = columns[sortColumn];

    if (column?.sortValue) {
      const getSortValue = column.sortValue;
      sortedRows.sort((first, second) => {
        const firstValue = getSortValue(first);
        const secondValue = getSortValue(second);
        const result = typeof firstValue === "number" && typeof secondValue === "number"
          ? firstValue - secondValue
          : String(firstValue).localeCompare(String(secondValue));

        return sortDirection === "ascending" ? result : -result;
      });
    }
  }

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * pageSize;
  const visibleRows = sortedRows.slice(firstRow, firstRow + pageSize);

  function sortByColumn(columnIndex: number) {
    const column = columns[columnIndex];

    if (!column.sortValue) {
      return;
    }

    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === "ascending" ? "descending" : "ascending");
    } else {
      setSortColumn(columnIndex);
      setSortDirection("ascending");
    }
    setPage(1);
  }

  if (loading) {
    return <AP_Loading label="Loading table data" />;
  }

  if (error) {
    return <AP_Error message={error} onRetry={onRetry ?? (() => window.location.reload())} />;
  }

  if (rows.length === 0) {
    return (
      <AP_Empty
        title="Nothing to show"
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.label}>
                {column.sortValue ? (
                  <AP_Button
                    className="table-sort-button"
                    onClick={() => sortByColumn(index)}
                    variant="text"
                  >
                    {column.label}
                    {sortColumn === index && (sortDirection === "ascending" ? " ↑" : " ↓")}
                  </AP_Button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-footer">
        <span>{firstRow + 1}–{Math.min(firstRow + visibleRows.length, rows.length)} of {rows.length}</span>
        <div className="table-pagination">
          <AP_Button
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            size="small"
            variant="text"
          >
            ‹
          </AP_Button>
          <span>{currentPage} / {pageCount}</span>
          <AP_Button
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
            size="small"
            variant="text"
          >
            ›
          </AP_Button>
        </div>
      </div>
    </div>
  );
}
