import { Box, CircularProgress, Alert, Typography, Paper } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { datasetsApi } from "../../api/datasets";

interface Props {
  datasetId: string;
}

export function DatasetPreview({ datasetId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    datasetsApi
      .preview(datasetId, 100)
      .then(({ data }) => {
        setTotalRows(data.total_rows);
        setColumns(
          data.columns.map((col) => ({
            field: col,
            headerName: col,
            flex: 1,
            minWidth: 120,
          }))
        );
        setRows(
          data.rows.map((row, idx) => {
            const obj: Record<string, unknown> = { id: idx };
            data.columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          })
        );
      })
      .catch(() => setError("Failed to load preview"))
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Showing first {rows.length} of {totalRows.toLocaleString()} rows
      </Typography>
      <Paper sx={{ height: 450 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          density="compact"
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
}
