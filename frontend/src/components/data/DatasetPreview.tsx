import { Box, CircularProgress, Alert, Chip, Typography, Paper, alpha } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { datasetsApi } from "../../api/datasets";
import TableChartIcon from "@mui/icons-material/TableChartRounded";

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

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box className="animate-fade-in">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <TableChartIcon sx={{ fontSize: 18, color: "#d2541c" }} />
        <Typography variant="body2" color="text.secondary">
          Showing first {rows.length} of {totalRows.toLocaleString()} rows
        </Typography>
        <Chip
          label={`${columns.length} columns`}
          size="small"
          sx={{ fontSize: "0.65rem", height: 20, bgcolor: alpha("#d2541c", 0.08), color: "#a8401a", fontWeight: 600 }}
        />
      </Box>
      <Paper sx={{ height: 450, borderRadius: 4, overflow: "hidden" }}>
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
