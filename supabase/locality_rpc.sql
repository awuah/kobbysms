CREATE OR REPLACE FUNCTION get_ks_locality_counts()
RETURNS TABLE (name TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(NULLIF(electoral_area, ''), 'Other') as name, count(*) as count
  FROM ks_constituents
  GROUP BY 1
  ORDER BY count DESC;
$$;
