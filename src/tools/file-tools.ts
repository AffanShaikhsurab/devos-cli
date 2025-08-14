import * as fs from 'fs';
import * as path from 'path';
import { projectContext } from '../utils/project-context.js';
import { createToolResponse, ToolResult } from './tool-utils.js';
import { writeFile, createDirectory, displayTree } from '../utils/file-ops.js';

// This needs to be passed in from the tool-registry
let readFiles: Set<string>;
export function setReadFileTrackerInstance(instance: Set<string>) {
  readFiles = instance;
}

/**
 * Read the contents of a file, optionally specifying line range
 */
export async function readFile(filePath: string, startLine?: number, endLine?: number): Promise<ToolResult> {
  try {
    // Sanitize the user-provided path to prevent directory traversal attacks
    const safeRelativePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.join(projectContext.bmadDir, safeRelativePath);

    // Security Check: Ensure the final path is still within the project's .bmad directory
    if (!resolvedPath.startsWith(projectContext.bmadDir)) {
      return createToolResponse(false, undefined, '', 'Error: Path traversal detected. Access denied.');
    }

    // Check if file exists
    try {
      await fs.promises.access(resolvedPath);
    } catch {
      return createToolResponse(false, undefined, '', 'Error: File not found');
    }

    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a file');
    }

    // Check file size (50MB limit)
    if (stats.size > 50 * 1024 * 1024) {
      return createToolResponse(false, undefined, '', 'Error: File too large (max 50MB)');
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    // Handle line range if specified
    if (startLine !== undefined) {
      const startIdx = Math.max(0, startLine - 1); // Convert to 0-indexed
      let endIdx = lines.length;

      if (endLine !== undefined) {
        endIdx = Math.min(lines.length, endLine);
      }

      if (startIdx >= lines.length) {
        return createToolResponse(false, undefined, '', 'Error: Start line exceeds file length');
      }

      const selectedLines = lines.slice(startIdx, endIdx);
      const selectedContent = selectedLines.join('\n');
      // Add file to read tracking for partial reads too
      if (readFiles) readFiles.add(resolvedPath);
      const message = `Read lines ${startLine}-${endIdx} from ${filePath}`;

      return createToolResponse(true, selectedContent, message);
    } else {
      // Add file to read tracking
      if (readFiles) readFiles.add(resolvedPath);
      const message = `Read ${lines.length} lines from ${filePath}`;
      return createToolResponse(true, content, message);
    }

  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return createToolResponse(false, undefined, '', 'Error: File not found');
    }
    return createToolResponse(false, undefined, '', 'Error: Failed to read file');
  }
}

/**
 * Create a new file or directory with specified content
 */
export async function createFile(filePath: string, content: string, fileType: string = 'file', overwrite: boolean = false): Promise<ToolResult> {
  try {
    const safeRelativePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = path.join(projectContext.bmadDir, safeRelativePath);

    if (!targetPath.startsWith(projectContext.bmadDir)) {
      return createToolResponse(false, undefined, '', 'Error: Path traversal detected. Access denied.');
    }

    // Check if file exists and handle overwrite
    const exists = await fs.promises.access(targetPath).then(() => true).catch(() => false);
    if (exists && !overwrite) {
      return createToolResponse(false, undefined, '', 'Error: File already exists, use overwrite=true');
    }

    if (fileType === 'directory') {
      const result = await createDirectory(targetPath);
      if (result) {
        return createToolResponse(true, { path: targetPath, type: 'directory' }, `Directory created: ${filePath}`);
      } else {
        return createToolResponse(false, undefined, '', 'Error: Failed to create directory');
      }
    } else if (fileType === 'file') {
      const result = await writeFile(targetPath, content, overwrite, true);
      if (result) {
        return createToolResponse(true, undefined, `File created: ${filePath}`);
      } else {
        return createToolResponse(false, undefined, '', 'Error: Failed to create file');
      }
    } else {
      return createToolResponse(false, undefined, '', "Error: Invalid file_type, must be 'file' or 'directory'");
    }

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to create file or directory');
  }
}

/**
 * Edit a file by replacing exact text strings
 */
export async function editFile(filePath: string, oldText: string, newText: string, replaceAll: boolean = false): Promise<ToolResult> {
  try {
    const safeRelativePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.join(projectContext.bmadDir, safeRelativePath);

    if (!resolvedPath.startsWith(projectContext.bmadDir)) {
      return createToolResponse(false, undefined, '', 'Error: Path traversal detected. Access denied.');
    }

    const originalContent = await fs.promises.readFile(resolvedPath, 'utf-8');
    let updatedContent: string;
    if (replaceAll) {
      updatedContent = originalContent.split(oldText).join(newText);
    } else {
      updatedContent = originalContent.replace(oldText, newText);
    }

    const result = await writeFile(filePath, updatedContent, true, true);
    if (result) {
      const replacementCount = replaceAll ?
        (originalContent.split(oldText).length - 1) : 1;
      return createToolResponse(true, undefined, `Replaced ${replacementCount} occurrence(s) in ${filePath}`);
    } else {
      return createToolResponse(false, undefined, '', 'Error: Failed to write changes to file');
    }

  } catch (error) {
    return createToolResponse(false, undefined, '', `Error: Failed to edit file - ${error}`);
  }
}

/**
 * Delete a file or directory with safety checks
 */
export async function deleteFile(filePath: string, recursive: boolean = false): Promise<ToolResult> {
  try {
    const safeRelativePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = path.join(projectContext.bmadDir, safeRelativePath);

    if (!targetPath.startsWith(projectContext.bmadDir)) {
      return createToolResponse(false, undefined, '', 'Error: Path traversal detected. Access denied.');
    }

    const exists = await fs.promises.access(targetPath).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Path not found');
    }

    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory() && !recursive) {
      const items = await fs.promises.readdir(targetPath);
      if (items.length > 0) {
        return createToolResponse(false, undefined, '', 'Error: Directory not empty, use recursive=true');
      }
    }

    if (stats.isDirectory()) {
      await fs.promises.rmdir(targetPath, { recursive });
    } else {
      await fs.promises.unlink(targetPath);
    }

    const fileType = stats.isDirectory() ? 'directory' : 'file';
    return createToolResponse(true, undefined, `Deleted ${fileType}: ${filePath}`);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to delete');
  }
}

/**
 * List files and directories in a path with tree-style display
 */
export async function listFiles(directory: string = '.', pattern: string = '*', recursive: boolean = false, showHidden: boolean = false): Promise<ToolResult> {
  try {
    const safeRelativePath = path.normalize(directory).replace(/^(\.\.(\/|\\|$))+/, '');
    const dirPath = path.join(projectContext.bmadDir, safeRelativePath);

    if (!dirPath.startsWith(projectContext.bmadDir)) {
      return createToolResponse(false, undefined, '', 'Error: Path traversal detected. Access denied.');
    }

    const exists = await fs.promises.access(dirPath).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Directory not found');
    }

    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a directory');
    }

    const treeOutput = await displayTree(directory, pattern, recursive, showHidden);

    return createToolResponse(true, treeOutput, `Listed ${directory}`);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to list files');
  }
}

// Helper function to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to detect binary files
function isBinaryFile(filename: string): boolean {
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
  ];

  const ext = path.extname(filename).toLowerCase();
  return binaryExtensions.includes(ext);
}

// Helper function to match glob-like patterns
function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`, 'i').test(filename);
}

// Helper function to collect files based on patterns and filters
async function collectFiles(
  directory: string,
  filePattern: string,
  fileTypes?: string[],
  excludeDirs?: string[],
  excludeFiles?: string[]
): Promise<string[]> {
  const files: string[] = [];

  async function walkDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (excludeDirs && excludeDirs.some(pattern => matchesPattern(entry.name, pattern))) {
            continue;
          }
          if (entry.name.startsWith('.') && !entry.name.match(/^\.(config|env)$/)) {
            continue;
          }
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          if (fileTypes && fileTypes.length > 0) {
            const ext = path.extname(entry.name).slice(1);
            if (!fileTypes.includes(ext)) {
              continue;
            }
          }
          if (!matchesPattern(entry.name, filePattern)) {
            continue;
          }
          if (excludeFiles && excludeFiles.some(pattern => matchesPattern(entry.name, pattern))) {
            continue;
          }
          if (isBinaryFile(entry.name)) {
            continue;
          }
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip
    }
  }

  await walkDirectory(directory);
  return files;
}

interface SearchMatch {
    lineNumber: number;
    lineContent: string;
    contextLines?: string[];
    matchPositions: Array<{
        start: number;
        end: number;
        text: string;
    }>;
}
interface SearchResult {
    filePath: string;
    matches: SearchMatch[];
    totalMatches: number;
}

export async function searchFiles(
  pattern: string,
  filePattern: string = '*',
  directory: string = '.',
  caseSensitive: boolean = false,
  patternType: 'substring' | 'regex' | 'exact' | 'fuzzy' = 'substring',
  fileTypes?: string[],
  excludeDirs?: string[],
  excludeFiles?: string[],
  maxResults: number = 100,
  contextLines: number = 0,
  groupByFile: boolean = false
): Promise<ToolResult> {
  try {
    const searchDir = path.resolve(directory);

    const exists = await fs.promises.access(searchDir).then(() => true).catch(() => false);
    if (!exists) {
      return createToolResponse(false, undefined, '', 'Error: Directory not found');
    }

    const stats = await fs.promises.stat(searchDir);
    if (!stats.isDirectory()) {
      return createToolResponse(false, undefined, '', 'Error: Path is not a directory');
    }

    const defaultExcludeDirs = ['.git', 'node_modules', '.next', 'dist', 'build', '.cache'];
    const defaultExcludeFiles = ['*.log', '*.tmp', '*.cache', '*.lock'];

    const finalExcludeDirs = [...defaultExcludeDirs, ...(excludeDirs || [])];
    const finalExcludeFiles = [...defaultExcludeFiles, ...(excludeFiles || [])];

    let searchRegex: RegExp;
    try {
      switch (patternType) {
        case 'exact':
          searchRegex = new RegExp(escapeRegex(pattern), caseSensitive ? 'g' : 'gi');
          break;
        case 'regex':
          searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
          break;
        case 'fuzzy':
          const fuzzyPattern = pattern.split('').map(escapeRegex).join('.*');
          searchRegex = new RegExp(fuzzyPattern, caseSensitive ? 'g' : 'gi');
          break;
        case 'substring':
        default:
          searchRegex = new RegExp(escapeRegex(pattern), caseSensitive ? 'g' : 'gi');
          break;
      }
    } catch (error) {
      return createToolResponse(false, undefined, '', 'Error: Invalid regex pattern');
    }

    const filesToSearch = await collectFiles(searchDir, filePattern, fileTypes, finalExcludeDirs, finalExcludeFiles);

    if (filesToSearch.length === 0) {
      return createToolResponse(true, [], 'No files found matching criteria');
    }

    const results: SearchResult[] = [];
    let totalMatches = 0;

    for (const filePath of filesToSearch) {
      if (totalMatches >= maxResults) {
        break;
      }

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const fileMatches: SearchMatch[] = [];

        for (let i = 0; i < lines.length && totalMatches < maxResults; i++) {
          const line = lines[i];
          const matches = Array.from(line.matchAll(searchRegex));

          if (matches.length > 0) {
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length - 1, i + contextLines);

            const contextLinesArray: string[] = [];
            for (let j = contextStart; j <= contextEnd; j++) {
              contextLinesArray.push(lines[j]);
            }

            fileMatches.push({
              lineNumber: i + 1,
              lineContent: line,
              contextLines: contextLines > 0 ? contextLinesArray : undefined,
              matchPositions: matches.map(match => ({
                start: match.index || 0,
                end: (match.index || 0) + match[0].length,
                text: match[0]
              }))
            });

            totalMatches++;
          }
        }

        if (fileMatches.length > 0) {
          results.push({
            filePath: path.relative(process.cwd(), filePath),
            matches: fileMatches,
            totalMatches: fileMatches.length
          });
        }

      } catch (error) {
        // Skip
      }
    }

    let formattedResults: any;
    if (groupByFile) {
      formattedResults = results;
    } else {
      formattedResults = results.flatMap(fileResult =>
        fileResult.matches.map(match => ({
          filePath: fileResult.filePath,
          lineNumber: match.lineNumber,
          lineContent: match.lineContent,
          contextLines: match.contextLines,
          matchPositions: match.matchPositions
        }))
      );
    }

    const message = `Found ${totalMatches} match(es) in ${results.length} file(s)`;
    return createToolResponse(true, formattedResults, message);

  } catch (error) {
    return createToolResponse(false, undefined, '', 'Error: Failed to search files');
  }
}
