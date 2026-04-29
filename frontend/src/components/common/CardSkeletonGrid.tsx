import { Box, Card, CardContent, Grid, Skeleton } from "@mui/material";

interface Props {
  count?: number;
  /** Number of fake "metadata" rows under the title. */
  metaLines?: number;
}

/** Generic skeleton placeholder that matches the dataset/pipeline card shape. */
export function CardSkeletonGrid({ count = 6, metaLines = 2 }: Props) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Skeleton variant="text" width="55%" height={26} />
                <Skeleton variant="rounded" width={56} height={20} />
              </Box>
              {Array.from({ length: metaLines }).map((__, j) => (
                <Skeleton key={j} variant="text" width={`${70 - j * 15}%`} height={16} />
              ))}
            </CardContent>
            <Box sx={{ px: 2, pb: 1.5, display: "flex", gap: 1 }}>
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="circular" width={24} height={24} />
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
