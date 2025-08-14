import {
  readFile,
  createFile,
  editFile,
  deleteFile,
  listFiles,
  searchFiles,
  setReadFileTrackerInstance,
} from './file-tools.js';
import { executeCommand } from './process-tools.js';
import { createTasks, updateTasks, executeBmadTask, createBmadDocument } from './task-tools.js';
import { setReadFilesTracker } from './validators.js';
import { ToolResult, createToolResponse } from './tool-utils.js';

// Centralize the read files tracker
const readFiles = new Set<string>();

export function initializeTools() {
  setReadFilesTracker(readFiles);
  setReadFileTrackerInstance(readFiles);
}

export const TOOL_REGISTRY = {
  read_file: readFile,
  create_file: createFile,
  edit_file: editFile,
  delete_file: deleteFile,
  list_files: listFiles,
  search_files: searchFiles,
  execute_command: executeCommand,
  create_tasks: createTasks,
  update_tasks: updateTasks,
  execute_bmad_task: executeBmadTask,
  create_bmad_document: createBmadDocument,
};

export async function executeTool(toolName: string, toolArgs: Record<string, any>): Promise<ToolResult> {
  if (!(toolName in TOOL_REGISTRY)) {
    return createToolResponse(false, undefined, '', 'Error: Unknown tool');
  }

  try {
    const toolFunction = (TOOL_REGISTRY as any)[toolName];

    switch (toolName) {
      case 'read_file':
        return await toolFunction(toolArgs.file_path, toolArgs.start_line, toolArgs.end_line);
      case 'create_file':
        return await toolFunction(toolArgs.file_path, toolArgs.content, toolArgs.file_type, toolArgs.overwrite);
      case 'edit_file':
        return await toolFunction(toolArgs.file_path, toolArgs.old_text, toolArgs.new_text, toolArgs.replace_all);
      case 'delete_file':
        return await toolFunction(toolArgs.file_path, toolArgs.recursive);
      case 'list_files':
        return await toolFunction(toolArgs.directory, toolArgs.pattern, toolArgs.recursive, toolArgs.show_hidden);
      case 'search_files':
        return await toolFunction(
          toolArgs.pattern,
          toolArgs.file_pattern,
          toolArgs.directory,
          toolArgs.case_sensitive,
          toolArgs.pattern_type,
          toolArgs.file_types,
          toolArgs.exclude_dirs,
          toolArgs.exclude_files,
          toolArgs.max_results,
          toolArgs.context_lines,
          toolArgs.group_by_file
        );
      case 'execute_command':
        return await toolFunction(toolArgs.command, toolArgs.command_type, toolArgs.working_directory, toolArgs.timeout);
      case 'create_tasks':
        return await toolFunction(toolArgs.user_query, toolArgs.tasks);
      case 'update_tasks':
        return await toolFunction(toolArgs.task_updates);
      case 'execute_bmad_task':
        return await toolFunction(toolArgs.task_id, toolArgs.params);
      case 'create_bmad_document':
        return await toolFunction(toolArgs.template_id, toolArgs.project_name);
      default:
        return createToolResponse(false, undefined, '', 'Error: Tool not implemented');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return createToolResponse(false, undefined, '', `Error: Invalid tool arguments for ${toolName}`);
    }
    return createToolResponse(false, undefined, '', `Error: Unexpected tool error in ${toolName}`);
  }
}
