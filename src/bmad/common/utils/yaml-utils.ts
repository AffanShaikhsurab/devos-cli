/**
 * Utility functions for YAML extraction from agent files
 */

/**
 * Extract YAML content from agent markdown files
 * @param {string} agentContent - The full content of the agent file
 * @param {boolean} cleanCommands - Whether to clean command descriptions (default: false)
 * @returns {string|null} - The extracted YAML content or null if not found
 */
export function extractYamlFromAgent(agentContent: string, cleanCommands: boolean = false): string | null {
  const lines = agentContent.split('\n');
  let inYamlBlock = false;
  const yamlLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '```yaml') {
      inYamlBlock = true;
      continue;
    }

    if (line.trim() === '```' && inYamlBlock) {
      break;
    }

    if (inYamlBlock) {
      yamlLines.push(line);
    }
  }

  if (yamlLines.length === 0) {
    return null;
  }

  let yamlContent = yamlLines.join('\n');

  // Remove span tags
  yamlContent = yamlContent.replace(/\[span_\d+\]\(start_span\)|\[span_\d+\]\(end_span\)/g, '');

  if (cleanCommands) {
    yamlContent = yamlContent.replace(/^(\s*-)(\s*"[^"]+")(\s*-\s*.*)$/gm, '$1$2');
  }

  return yamlContent;
}
