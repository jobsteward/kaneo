import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { activeWorkspaceIdOf } from "./active-workspace-id";
import {
  lookupTaskWorkspaceIds,
  lookupWorkspaceId,
  type WorkspaceResource,
} from "./lookup-workspace-id";
import { validateWorkspaceAccess } from "./validate-workspace-access";

type WorkspaceIdSource =
  | { type: "query"; key: string }
  | { type: "body"; key: string }
  | { type: "param"; key: string }
  | {
      type: "lookup";
      resource: WorkspaceResource;
      idKey: string;
    }
  | {
      type: "lookupMany";
      resource: "task";
      idKey: string;
    };
type WorkspaceAccessMiddlewareConfig = {
  sources: WorkspaceIdSource[];
};
async function readJsonObjectBody(
  c: Context,
): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) || {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export function workspaceAccessMiddleware(
  config: WorkspaceAccessMiddlewareConfig,
) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    let workspaceId: string | null = null;

    for (const source of config.sources) {
      if (source.type === "query") {
        workspaceId = c.req.query(source.key) || null;
      } else if (source.type === "body") {
        const body = await readJsonObjectBody(c);
        const bodyValue = body[source.key];
        workspaceId = typeof bodyValue === "string" ? bodyValue : null;
      } else if (source.type === "param") {
        workspaceId = c.req.param(source.key) || null;
      } else if (source.type === "lookup") {
        const body = await readJsonObjectBody(c);
        const bodyId = body[source.idKey];
        const idFromBody = typeof bodyId === "string" ? bodyId : null;
        // Only accept the id from the same place the handler will read it
        // (path param or JSON body). Accepting it from the query string let a
        // caller authorize against one resource (`?taskId=<mine>`) while the
        // handler acted on another (`{"taskId": "<someone else's>"}`).
        const id = c.req.param(source.idKey) || idFromBody;
        if (id) {
          workspaceId = await lookupWorkspaceId(source.resource, id);
        }
      } else if (source.type === "lookupMany") {
        const body = await readJsonObjectBody(c);
        const ids = body[source.idKey];
        if (Array.isArray(ids)) {
          const taskIds = ids.filter(
            (id): id is string => typeof id === "string",
          );
          if (taskIds.length > 0) {
            const workspaceIds = await lookupTaskWorkspaceIds(taskIds);
            if (workspaceIds.length === 0) {
              throw new HTTPException(404, { message: "No tasks found" });
            }
            if (workspaceIds.length > 1) {
              throw new HTTPException(400, {
                message: "All tasks must belong to the same workspace",
              });
            }
            workspaceId = workspaceIds[0] ?? null;
          }
        }
      }

      if (workspaceId) {
        break;
      }
    }

    if (!workspaceId) {
      throw new HTTPException(400, {
        message: "Workspace ID could not be determined",
      });
    }

    const apiKey = c.get("apiKey");
    const apiKeyId = apiKey?.id;
    await validateWorkspaceAccess(
      userId,
      workspaceId,
      apiKeyId,
      activeWorkspaceIdOf(c),
    );

    c.set("workspaceId", workspaceId);

    return next();
  };
}

export const workspaceAccess = {
  fromQuery: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "query", key }] }),
  fromBody: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "body", key }] }),
  fromParam: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "param", key }] }),
  fromProject: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "project", idKey }],
    }),
  fromTask: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromTaskId: (idKey = "taskId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromTasks: (idKey = "taskIds") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookupMany", resource: "task", idKey }],
    }),
  fromLabel: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "label", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromTimeEntry: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "timeEntry", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromActivity: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "activity", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromComment: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "comment", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromColumn: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "column", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromWorkflowRule: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "workflowRule", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
  fromCustomField: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "customField", idKey }],
    }),
  fromProjectId: (idKey = "projectId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "project", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
};
