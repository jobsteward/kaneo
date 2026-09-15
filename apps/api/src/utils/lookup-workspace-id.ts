import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";

export type WorkspaceResource =
  | "project"
  | "task"
  | "label"
  | "timeEntry"
  | "activity"
  | "comment"
  | "column"
  | "workflowRule"
  | "customField";

export async function lookupWorkspaceId(
  resource: WorkspaceResource,
  id: string,
): Promise<string | null> {
  try {
    switch (resource) {
      case "project": {
        const [project] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.projectTable)
          .where(eq(schema.projectTable.id, id))
          .limit(1);
        return project?.workspaceId || null;
      }
      case "task": {
        const [task] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.taskTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.taskTable.id, id))
          .limit(1);
        return task?.workspaceId || null;
      }
      case "label": {
        const [label] = await db
          .select({ workspaceId: schema.labelTable.workspaceId })
          .from(schema.labelTable)
          .where(eq(schema.labelTable.id, id))
          .limit(1);
        return label?.workspaceId || null;
      }
      case "timeEntry": {
        const [timeEntry] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.timeEntryTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.timeEntryTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.timeEntryTable.id, id))
          .limit(1);
        return timeEntry?.workspaceId || null;
      }
      case "activity": {
        const [activity] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.activityTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.activityTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.activityTable.id, id))
          .limit(1);
        return activity?.workspaceId || null;
      }
      case "comment": {
        const [comment] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.activityTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.activityTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(
            and(
              eq(schema.activityTable.id, id),
              eq(schema.activityTable.type, "comment"),
            ),
          )
          .limit(1);
        return comment?.workspaceId || null;
      }
      case "column": {
        const [column] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.columnTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.columnTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.columnTable.id, id))
          .limit(1);
        return column?.workspaceId || null;
      }
      case "workflowRule": {
        const [workflowRule] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.workflowRuleTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.workflowRuleTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.workflowRuleTable.id, id))
          .limit(1);
        return workflowRule?.workspaceId || null;
      }
      case "customField": {
        const [field] = await db
          .select({ workspaceId: schema.projectTable.workspaceId })
          .from(schema.customFieldDefinitionTable)
          .innerJoin(
            schema.projectTable,
            eq(
              schema.customFieldDefinitionTable.projectId,
              schema.projectTable.id,
            ),
          )
          .where(eq(schema.customFieldDefinitionTable.id, id))
          .limit(1);
        return field?.workspaceId || null;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error looking up workspaceId for ${resource}:`, error);
    return null;
  }
}

export async function lookupTaskWorkspaceIds(taskIds: string[]) {
  const tasks = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(inArray(schema.taskTable.id, taskIds));
  return [...new Set(tasks.map((task) => task.workspaceId))];
}
