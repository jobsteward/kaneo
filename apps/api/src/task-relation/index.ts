import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createTaskRelation from "./controllers/create-task-relation";
import deleteTaskRelation from "./controllers/delete-task-relation";
import getTaskRelations from "./controllers/get-task-relations";
import {
  taskRelationSchema,
  taskRelationWithTasksListSchema,
} from "./response";
import {
  createTaskRelationBody,
  taskIdParam,
  taskRelationParam,
} from "./schema";
import { scopeToRelation, scopeToSourceTask } from "./scope";

const getTaskRelationsRoute = createRoute({
  method: "get",
  operationId: "getTaskRelations",
  path: "/{taskId}",
  tags: ["Task Relations"],
  summary: "Get task relations",
  description:
    "Get every relation where the task is the source or the target, each with a summary of both linked tasks. Relations pointing outside the caller's workspace are omitted.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse(
      "Task relations with the linked task summaries",
      taskRelationWithTasksListSchema,
    ),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const createTaskRelationRoute = createRoute({
  method: "post",
  operationId: "createTaskRelation",
  path: "/",
  tags: ["Task Relations"],
  summary: "Create task relation",
  description:
    "Link two tasks. Authorization is scoped to the source task's workspace.",
  middleware: [
    scopeToSourceTask,
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTaskRelationBody } },
    },
  },
  responses: {
    200: jsonResponse("The created relation", taskRelationSchema),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Source or target task not found"),
    409: errorResponse("This relation already exists"),
  },
});

const deleteTaskRelationRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskRelation",
  path: "/{id}",
  tags: ["Task Relations"],
  summary: "Delete task relation",
  description: "Remove a link between two tasks. Returns the deleted relation.",
  middleware: [
    scopeToRelation,
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: taskRelationParam },
  responses: {
    200: jsonResponse("The deleted relation", taskRelationSchema),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Task relation not found, or its source task is gone"),
  },
});

const taskRelation = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getTaskRelationsRoute, async (c) =>
    c.json(
      await getTaskRelations(c.req.valid("param").taskId, c.get("workspaceId")),
      200,
    ),
  )
  .openapi(createTaskRelationRoute, async (c) => {
    const { sourceTaskId, targetTaskId, relationType } = c.req.valid("json");
    return c.json(
      await createTaskRelation({
        sourceTaskId,
        targetTaskId,
        relationType,
        userId: c.get("userId"),
        workspaceId: c.get("workspaceId"),
      }),
      200,
    );
  })
  .openapi(deleteTaskRelationRoute, async (c) =>
    c.json(
      await deleteTaskRelation(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  );

export default taskRelation;
