//
// FILE: src/tools/task-tools.ts
//
import { createToolResponse, ToolResult } from './tool-utils.js';
import { projectContext } from '../utils/project-context.js';
import * as fs from 'fs-extra';
import * as path from 'path';

// Define the structure of an update for a single task
interface TaskUpdate {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

// Define the structure of a single task
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  updated_at?: string;
}

/**
 * Creates a new task list and saves it to a persistent file.
 * This function will overwrite any existing plan.
 */
export async function createTasks(userQuery: string, tasks: Task[]): Promise<ToolResult> {
  const planPath = path.join(projectContext.bmadDir, 'session_plan.json');
  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.id || !task.description) {
        return createToolResponse(false, undefined, '', `Error: Task ${i} missing required fields (id, description)`);
      }
      if (!task.status) {
        task.status = 'pending';
      }
      if (!['pending', 'in_progress', 'completed'].includes(task.status)) {
        return createToolResponse(false, undefined, '', `Error: Invalid status '${task.status}' for task ${task.id}`);
      }
    }

    const taskList = {
      user_query: userQuery,
      tasks: tasks,
      created_at: new Date().toISOString()
    };

    // Write the new plan to the file system as a JSON file
    await fs.writeJson(planPath, taskList, { spaces: 2 });

    return createToolResponse(
      true,
      taskList,
      `Created and saved a task list with ${tasks.length} tasks for: ${userQuery}`
    );
  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to create and save tasks - ${error}`);
  }
}

/**
 * Updates tasks in the persistent session plan file.
 */
export async function updateTasks(taskUpdates: TaskUpdate[]): Promise<ToolResult> {
  const planPath = path.join(projectContext.bmadDir, 'session_plan.json');
  try {
    // Check if a plan file exists before trying to update it
    const exists = await fs.pathExists(planPath);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: No task list exists. Create tasks first.');
    }

    // Read the existing plan from the file
    const taskList = await fs.readJson(planPath);
    const updatesMade: Array<{ id: string; description: string; old_status: string; new_status: string; }> = [];

    for (const update of taskUpdates) {
      if (!update.id || !update.status) {
        return createToolResponse(false, undefined, '', 'Error: Task update missing required fields (id, status)');
      }
      if (!['pending', 'in_progress', 'completed'].includes(update.status)) {
        return createToolResponse(false, undefined, '', `Error: Invalid status '${update.status}'`);
      }

      let taskFound = false;
      for (const task of taskList.tasks) {
        if (task.id === update.id) {
          const oldStatus = task.status;
          task.status = update.status;
          if (update.notes) {
            task.notes = update.notes;
          }
          task.updated_at = new Date().toISOString();
          updatesMade.push({
            id: update.id,
            description: task.description,
            old_status: oldStatus,
            new_status: update.status
          });
          taskFound = true;
          break;
        }
      }

      if (!taskFound) {
        return createToolResponse(false, undefined, '', `Error: Task '${update.id}' not found`);
      }
    }

    // Write the updated plan back to the file
    await fs.writeJson(planPath, taskList, { spaces: 2 });

    return createToolResponse(
      true,
      taskList,
      `Updated ${updatesMade.length} task(s) in the session plan`
    );
  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to update tasks - ${error}`);
  }
}

/**
 * Reads the persistent session plan from disk.
 * This is a new tool for the AI to check the plan.
 */
export async function getTasks(): Promise<ToolResult> {
  const planPath = path.join(projectContext.bmadDir, 'session_plan.json');
  try {
    const exists = await fs.pathExists(planPath);
    if (!exists) {
      return createToolResponse(true, null, 'No active plan found.');
    }
    const planContent = await fs.readJson(planPath);
    return createToolResponse(true, planContent, 'Successfully retrieved the active plan.');
  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to read the session plan.');
  }
}

/**
 * Clears the persistent session plan from disk.
 * This is a new tool for the AI to use when a plan is finished.
 */
export async function clearTasks(): Promise<ToolResult> {
  const planPath = path.join(projectContext.bmadDir, 'session_plan.json');
  try {
    const exists = await fs.pathExists(planPath);
    if (exists) {
      await fs.remove(planPath);
    }
    return createToolResponse(true, undefined, 'Successfully cleared the active plan.');
  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to clear the session plan.');
  }
}

/**
 * Placeholder for executing a structured BMad task.
 * NOTE: This tool is defined in the schema but not yet fully implemented.
 */
export async function executeBmadTask(taskId: string, params: Record<string, any>): Promise<ToolResult> {
  // To be implemented: This would involve loading the task definition from a file
  // and executing its steps.
  return createToolResponse(false, undefined, '', `Error: Tool 'execute_bmad_task' is defined but not yet implemented.`);
}

/**
 * Placeholder for creating a BMad document from a template.
 * NOTE: This tool is defined in the schema but not yet fully implemented.
 */
export async function createBmadDocument(templateId: string, projectName: string): Promise<ToolResult> {
  // To be implemented: This would involve processing a YAML template to generate
  // a full markdown document.
  return createToolResponse(false, undefined, '', `Error: Tool 'create_bmad_document' is defined but not yet implemented.`);
}
