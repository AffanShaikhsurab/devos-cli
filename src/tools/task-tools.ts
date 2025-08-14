import { createToolResponse, ToolResult } from './tool-utils.js';

interface TaskUpdate {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  updated_at?: string;
}

let currentTaskList: {
  user_query: string;
  tasks: Task[];
  created_at: string;
} | null = null;

export async function createTasks(userQuery: string, tasks: Task[]): Promise<ToolResult> {
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

    currentTaskList = {
      user_query: userQuery,
      tasks: tasks,
      created_at: new Date().toISOString()
    };

    const snapshot = {
      user_query: currentTaskList.user_query,
      tasks: currentTaskList.tasks.map(task => ({ ...task })),
      created_at: currentTaskList.created_at
    };

    return createToolResponse(
      true,
      snapshot,
      `Created task list with ${tasks.length} tasks for: ${userQuery}`
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to create tasks - ${error}`);
  }
}

export async function updateTasks(taskUpdates: TaskUpdate[]): Promise<ToolResult> {
  try {
    if (!currentTaskList) {
      return createToolResponse(false, undefined, '', 'Error: No task list exists. Create tasks first.');
    }

    const updatesMade: Array<{
      id: string;
      description: string;
      old_status: string;
      new_status: string;
    }> = [];

    for (const update of taskUpdates) {
      if (!update.id || !update.status) {
        return createToolResponse(false, undefined, '', 'Error: Task update missing required fields (id, status)');
      }
      if (!['pending', 'in_progress', 'completed'].includes(update.status)) {
        return createToolResponse(false, undefined, '', `Error: Invalid status '${update.status}'`);
      }

      let taskFound = false;
      for (const task of currentTaskList.tasks) {
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

    const snapshot = {
      user_query: currentTaskList.user_query,
      tasks: currentTaskList.tasks.map(task => ({ ...task })),
      created_at: currentTaskList.created_at
    };

    return createToolResponse(
      true,
      snapshot,
      `Updated ${updatesMade.length} task(s)`
    );

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to update tasks - ${error}`);
  }
}
