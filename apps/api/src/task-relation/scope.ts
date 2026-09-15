import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";
import { activeWorkspaceIdOf } from "../utils/active-workspace-id";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";

async function workspaceIdOfTask(taskId: string) {
  const [task] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  return task?.workspaceId ?? null;
}

function requireUserId(c: Context) {
  const userId = c.get("userId");
  if (!userId) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return userId as string;
}

export async function scopeToSourceTask(c: Context, next: Next) {
  const userId = requireUserId(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    sourceTaskId?: unknown;
  };
  const sourceTaskId =
    typeof body?.sourceTaskId === "string" ? body.sourceTaskId : null;
  if (!sourceTaskId) {
    throw new HTTPException(400, { message: "sourceTaskId is required" });
  }

  const workspaceId = await workspaceIdOfTask(sourceTaskId);
  if (!workspaceId) {
    throw new HTTPException(404, { message: "Source task not found" });
  }

  await validateWorkspaceAccess(
    userId,
    workspaceId,
    c.get("apiKey")?.id,
    activeWorkspaceIdOf(c),
  );
  c.set("workspaceId", workspaceId);
  return next();
}

export async function scopeToRelation(c: Context, next: Next) {
  const userId = requireUserId(c);
  const id = c.req.param("id");
  const [relation] = await db
    .select({ sourceTaskId: taskRelationTable.sourceTaskId })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.id, id ?? ""))
    .limit(1);
  if (!relation) {
    throw new HTTPException(404, { message: "Task relation not found" });
  }

  const workspaceId = await workspaceIdOfTask(relation.sourceTaskId);
  if (!workspaceId) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  await validateWorkspaceAccess(
    userId,
    workspaceId,
    c.get("apiKey")?.id,
    activeWorkspaceIdOf(c),
  );
  c.set("workspaceId", workspaceId);
  return next();
}
