-- Backfill existing workflow JSON into the first-class workflow table.
INSERT INTO "WorkspaceWorkflow" (
  "id",
  "userId",
  "workflowId",
  "workspaceKind",
  "title",
  "updatedAt",
  "canvasJson",
  "usageSummary",
  "deletedAt",
  "createdAt",
  "storedAt"
)
SELECT
  item->>'id' AS "id",
  state."userId" AS "userId",
  item->>'id' AS "workflowId",
  'workflow' AS "workspaceKind",
  COALESCE(NULLIF(item->>'title', ''), '新工作流') AS "title",
  CASE
    WHEN item->>'updatedAt' ~ '^\d+(\.\d+)?$' THEN to_timestamp(((item->>'updatedAt')::double precision) / 1000.0)
    ELSE NOW()
  END AS "updatedAt",
  COALESCE(item->'canvas', '{}'::jsonb) AS "canvasJson",
  item->'usageSummary' AS "usageSummary",
  CASE
    WHEN item->>'deletedAt' ~ '^\d+(\.\d+)?$' THEN to_timestamp(((item->>'deletedAt')::double precision) / 1000.0)
    ELSE NULL
  END AS "deletedAt",
  NOW() AS "createdAt",
  NOW() AS "storedAt"
FROM "UserWorkspaceState" state
CROSS JOIN LATERAL jsonb_array_elements(state."state"->'workflowItems') AS item
WHERE jsonb_typeof(state."state"->'workflowItems') = 'array'
  AND item ? 'id'
  AND item->>'id' <> ''
ON CONFLICT ("userId", "workflowId") DO UPDATE SET
  "workspaceKind" = 'workflow',
  "title" = EXCLUDED."title",
  "updatedAt" = EXCLUDED."updatedAt",
  "canvasJson" = EXCLUDED."canvasJson",
  "usageSummary" = EXCLUDED."usageSummary",
  "deletedAt" = EXCLUDED."deletedAt";
