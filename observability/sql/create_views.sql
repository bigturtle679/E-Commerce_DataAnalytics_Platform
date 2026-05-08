-- Observability views — queryable layer over raw._pipeline_metrics
-- Idempotent: CREATE OR REPLACE

CREATE SCHEMA IF NOT EXISTS observability;

-- Recent pipeline runs (last 100)
CREATE OR REPLACE VIEW observability.v_pipeline_runs AS
SELECT
    id,
    pipeline_name,
    task_name,
    status,
    rows_processed,
    duration_sec,
    error_message,
    started_at,
    completed_at,
    created_at
FROM raw._pipeline_metrics
ORDER BY started_at DESC
LIMIT 100;

-- Aggregated task statistics
CREATE OR REPLACE VIEW observability.v_task_stats AS
SELECT
    task_name,
    COUNT(*)                                           AS total_runs,
    COUNT(*) FILTER (WHERE status = 'success')         AS successes,
    COUNT(*) FILTER (WHERE status = 'failure')         AS failures,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0),
        1
    )                                                  AS success_rate_pct,
    ROUND(AVG(duration_sec)::numeric, 3)               AS avg_duration_sec,
    ROUND(MAX(duration_sec)::numeric, 3)               AS max_duration_sec,
    SUM(rows_processed)                                AS total_rows_processed,
    MAX(started_at)                                    AS last_run_at
FROM raw._pipeline_metrics
GROUP BY task_name;

-- System health overview
CREATE OR REPLACE VIEW observability.v_system_health AS
SELECT
    pipeline_name,
    MAX(completed_at)                                  AS last_completed_at,
    MAX(completed_at) FILTER (WHERE status = 'success') AS last_success_at,
    MAX(completed_at) FILTER (WHERE status = 'failure') AS last_failure_at,
    COUNT(*) FILTER (WHERE status = 'failure'
        AND started_at > NOW() - INTERVAL '24 hours')  AS failures_last_24h,
    COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS runs_last_24h
FROM raw._pipeline_metrics
GROUP BY pipeline_name;

-- Hourly throughput (last 7 days)
CREATE OR REPLACE VIEW observability.v_hourly_throughput AS
SELECT
    DATE_TRUNC('hour', started_at)   AS hour,
    SUM(rows_processed)              AS rows_processed,
    COUNT(*)                         AS run_count,
    ROUND(AVG(duration_sec)::numeric, 3) AS avg_duration_sec
FROM raw._pipeline_metrics
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', started_at)
ORDER BY hour DESC;
