import Groq from 'groq-sdk';
import { executeTool } from '../tools/tools.js';
import { validateReadBeforeEdit, getReadBeforeEditError } from '../tools/validators.js';
import { ALL_TOOL_SCHEMAS, DANGEROUS_TOOLS, APPROVAL_REQUIRED_TOOLS } from '../tools/tool-schemas.js';
import { ConfigManager } from '../utils/local-settings.js';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { extractYamlFromAgent } from '../bmad/common/utils/yaml-utils.js';
import { fileURLToPath } from 'url';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export class Agent {
  private client: Groq | null = null;
  private messages: Message[] = [];
  private apiKey: string | null = null;
  private model: string;
  private temperature: number;
  private sessionAutoApprove: boolean = false;
  private systemMessage: string;
  private configManager: ConfigManager;
  private onToolStart?: (name: string, args: Record<string, any>) => void;
  private onToolEnd?: (name: string, result: any) => void;
  private onToolApproval?: (toolName: string, toolArgs: Record<string, any>) => Promise<{ approved: boolean; autoApproveSession?: boolean }>;
  private onThinkingText?: (content: string, reasoning?: string) => void;
  private onFinalMessage?: (content: string, reasoning?: string) => void;
  private onMaxIterations?: (maxIterations: number) => Promise<boolean>;
  private onApiUsage?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void;
  private requestCount: number = 0;
  private currentAbortController: AbortController | null = null;
  private isInterrupted: boolean = false;
  private activeBmadAgent: string | null = 'bmad-master'; // Default agent

  private constructor(
    model: string,
    temperature: number,
    systemMessage: string | null,
    debug?: boolean
  ) {
    this.model = model;
    this.temperature = temperature;
    this.configManager = new ConfigManager();
    
    // Set debug mode
    debugEnabled = debug || false;

    // System message is now handled in the async create method
    this.systemMessage = systemMessage || '';
  }

  static async create(
    model: string,
    temperature: number,
    systemMessage: string | null,
    debug?: boolean
  ): Promise<Agent> {
    // Check for default model in config if model not explicitly provided
    const configManager = new ConfigManager();
    const defaultModel = configManager.getDefaultModel();
    const selectedModel = defaultModel || model;
    
    const agent = new Agent(
      selectedModel,
      temperature,
      systemMessage,
      debug
    );

    if (!systemMessage) {
      agent.systemMessage = await agent.buildDefaultSystemMessage();
    }

    agent.messages.push({ role: 'system', content: agent.systemMessage });

    return agent;
  }

  public async setActiveBmadAgent(agentId: string): Promise<void> {
    this.activeBmadAgent = agentId;
    // Re-generate and update the system message in the conversation history
    this.systemMessage = await this.buildDefaultSystemMessage();
    const systemMsgIndex = this.messages.findIndex(msg => msg.role === 'system');
    if (systemMsgIndex >= 0) {
      this.messages[systemMsgIndex].content = this.systemMessage;
    } else {
      this.messages.unshift({ role: 'system', content: this.systemMessage });
    }
  }

  private async buildDefaultSystemMessage(): Promise<string> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const isDist = __filename.includes('dist');

    // Base prompt for the Groq CLI
    let systemMessage = `You are a coding assistant powered by ${this.model} on Groq, operating within the BMad-Method framework.`;

    if (this.activeBmadAgent) {
      try {
        const bmadBasePath = isDist ?
            path.resolve(__dirname, '..', '..', 'src', 'bmad') :
            path.resolve(__dirname, '..', 'bmad');

        // 1. Load the agent's markdown file
        const agentFilePath = path.join(bmadBasePath, 'bmad-core', 'agents', `${this.activeBmadAgent}.md`);
        const agentContent = await fs.readFile(agentFilePath, 'utf-8');

        // 2. Extract the YAML configuration from the agent file
        const yamlContent = extractYamlFromAgent(agentContent);
        if (yamlContent) {
            const agentConfig = yaml.load(yamlContent) as any;

            // 3. Prepend the agent's persona and core principles
            const persona = agentConfig.persona;
            if (persona) {
                systemMessage += `\n\nCRITICAL: You are now operating as the ${persona.role}.
                Your identity is: ${persona.identity}.
                Your core principles are:
                ${(persona.core_principles || []).map((p: string) => `- ${p}`).join('\n')}`;
            }
        }
      } catch (error) {
          debugLog(`Could not load BMad agent ${this.activeBmadAgent}:`, error);
          systemMessage += `\n\nWarning: Could not load the specified BMad agent persona. Please ensure the agent ID is correct.`;
      }
    }

    // Add BMad's core operational rules and the CLI's tool usage rules
    systemMessage += `\n\nFollow the BMad workflow: planning and documentation come first, followed by sequential, story-driven development. Use the high-level BMad tasks available to you.`;
    systemMessage += `\nCRITICAL CONTEXT PROVIDED: When available, necessary context from PRD and Architecture documents will be provided at the beginning of the prompt. You MUST use this context for implementation and not request it again.`;

    return systemMessage;
  }


  public setToolCallbacks(callbacks: {
    onToolStart?: (name: string, args: Record<string, any>) => void;
    onToolEnd?: (name: string, result: any) => void;
    onToolApproval?: (toolName: string, toolArgs: Record<string, any>) => Promise<{ approved: boolean; autoApproveSession?: boolean }>;
    onThinkingText?: (content: string) => void;
    onFinalMessage?: (content: string) => void;
    onMaxIterations?: (maxIterations: number) => Promise<boolean>;
    onApiUsage?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void;
  }) {
    this.onToolStart = callbacks.onToolStart;
    this.onToolEnd = callbacks.onToolEnd;
    this.onToolApproval = callbacks.onToolApproval;
    this.onThinkingText = callbacks.onThinkingText;
    this.onFinalMessage = callbacks.onFinalMessage;
    this.onMaxIterations = callbacks.onMaxIterations;
    this.onApiUsage = callbacks.onApiUsage;
  }

  public setApiKey(apiKey: string): void {
    debugLog('Setting API key in agent...');
    debugLog('API key provided:', apiKey ? `${apiKey.substring(0, 8)}...` : 'empty');
    this.apiKey = apiKey;
    this.client = new Groq({ apiKey });
    debugLog('Groq client initialized with provided API key');
  }

  public saveApiKey(apiKey: string): void {
    this.configManager.setApiKey(apiKey);
    this.setApiKey(apiKey);
  }

  public clearApiKey(): void {
    this.configManager.clearApiKey();
    this.apiKey = null;
    this.client = null;
  }

  public clearHistory(): void {
    // Reset messages to only contain system messages
    this.messages = this.messages.filter(msg => msg.role === 'system');
  }

  public async setModel(model: string): Promise<void> {
    this.model = model;
    // Save as default model
    this.configManager.setDefaultModel(model);
    // Update system message to reflect new model
    const newSystemMessage = await this.buildDefaultSystemMessage();
    this.systemMessage = newSystemMessage;
    // Update the system message in the conversation
    const systemMsgIndex = this.messages.findIndex(msg => msg.role === 'system');
    if (systemMsgIndex >= 0) {
      this.messages[systemMsgIndex].content = newSystemMessage;
    } else {
        this.messages.unshift({ role: 'system', content: this.systemMessage });
    }
  }

  public getCurrentModel(): string {
    return this.model;
  }

  public getSystemMessage(): string {
    return this.systemMessage;
  }

  public getActiveBmadAgent(): string | null {
    return this.activeBmadAgent;
  }

  public setSessionAutoApprove(enabled: boolean): void {
    this.sessionAutoApprove = enabled;
  }

  public interrupt(): void {
    debugLog('Interrupting current request');
    this.isInterrupted = true;
    
    if (this.currentAbortController) {
      debugLog('Aborting current API request');
      this.currentAbortController.abort();
    }
    
    // Add interruption message to conversation
    this.messages.push({
      role: 'system',
      content: 'User has interrupted the request.'
    });
  }

  private async injectContextForInput(userInput: string): Promise<string> {
      const implementationCommands = ['/implement', '/dev', '/develop', '/repair'];
      const commandParts = userInput.trim().split(' ');
      const command = commandParts[0];

      if (implementationCommands.includes(command) && commandParts.length > 1) {
          const storyFilePath = commandParts[1];
          debugLog(`Context injection triggered for story: ${storyFilePath}`);
          try {
              const storyContent = await fs.readFile(storyFilePath, 'utf-8');
              const devNotesMatch = storyContent.match(/## Dev Notes\n\n([\s\S]*?)(?=\n## |$)/);

              if (devNotesMatch) {
                  const devNotes = devNotesMatch[1];
                  const sourceRegex = /\[Source: ([\w\/-]+\.md)[\w#]*\]/g;
                  const requiredDocs = new Set<string>();
                  let match;
                  while ((match = sourceRegex.exec(devNotes)) !== null) {
                      requiredDocs.add(match[1]);
                  }

                  let contextBlock = 'CRITICAL CONTEXT BLOCK: The following documentation is required to complete the task. You MUST use this information.\n\n';
                  for (const docPath of requiredDocs) {
                      const fullDocPath = path.resolve(process.cwd(), 'docs', docPath);
                      if (await fs.pathExists(fullDocPath)) {
                          const docContent = await fs.readFile(fullDocPath, 'utf-8');
                          contextBlock += `--- BEGIN DOCUMENT: ${docPath} ---\n${docContent}\n--- END DOCUMENT: ${docPath} ---\n\n`;
                      }
                  const docPromises = Array.from(requiredDocs).map(async (docPath) => {
                      const fullDocPath = path.resolve(process.cwd(), 'docs', docPath);
                      if (await fs.pathExists(fullDocPath)) {
                          const docContent = await fs.readFile(fullDocPath, 'utf-8');
                          return `--- BEGIN DOCUMENT: ${docPath} ---\n${docContent}\n--- END DOCUMENT: ${docPath} ---\n\n`;
                      }
                      return '';
                  });
                  const docBlocks = await Promise.all(docPromises);
                  contextBlock += docBlocks.filter(Boolean).join('');
                  return `${contextBlock}\nOriginal Request: ${userInput}`;
              }
          } catch (error) {
              debugLog('Could not perform automatic context injection:', error);
          }
      }
      return userInput; // Return original input if no injection occurs
  }

  async chat(userInput: string): Promise<void> {
    // Reset interrupt flag at the start of a new chat
    this.isInterrupted = false;
    
    // Check API key on first message send
    if (!this.client) {
      debugLog('Initializing Groq client...');
      // Try environment variable first
      const envApiKey = process.env.GROQ_API_KEY;
      if (envApiKey) {
        debugLog('Using API key from environment variable');
        this.setApiKey(envApiKey);
      } else {
        // Try config file
        debugLog('Environment variable GROQ_API_KEY not found, checking config file');
        const configApiKey = this.configManager.getApiKey();
        if (configApiKey) {
          debugLog('Using API key from config file');
          this.setApiKey(configApiKey);
        } else {
          debugLog('No API key found anywhere');
          throw new Error('No API key available. Please use /login to set your Groq API key.');
        }
      }
      debugLog('Groq client initialized successfully');
    }

    const finalUserInput = await this.injectContextForInput(userInput);
    this.messages.push({ role: 'user', content: finalUserInput });

    const maxIterations = 50;
    let iteration = 0;

    while (true) { // Outer loop for iteration reset
      while (iteration < maxIterations) {
        // Check for interruption before each iteration
        if (this.isInterrupted) {
          debugLog('Chat loop interrupted by user');
          this.currentAbortController = null;
          return;
        }
        
        try {
          // Check client exists
          if (!this.client) {
            throw new Error('Groq client not initialized');
          }

          debugLog('Making API call to Groq with model:', this.model);
          debugLog('Messages count:', this.messages.length);
          debugLog('Last few messages:', this.messages.slice(-3));
          
          // Prepare request body for curl logging
          const requestBody = {
            model: this.model,
            messages: this.messages,
            tools: ALL_TOOL_SCHEMAS,
            tool_choice: 'auto' as const,
            temperature: this.temperature,
            max_tokens: 8000,
            stream: false as const
          };
          
          // Log equivalent curl command
          this.requestCount++;
          const curlCommand = generateCurlCommand(this.apiKey!, requestBody, this.requestCount);
          if (curlCommand) {
            debugLog('Equivalent curl command:', curlCommand);
          }
          
          // Create AbortController for this request
          this.currentAbortController = new AbortController();
          
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: this.messages as any,
            tools: ALL_TOOL_SCHEMAS,
            tool_choice: 'auto',
            temperature: this.temperature,
            max_tokens: 8000,
            stream: false
          }, {
            signal: this.currentAbortController.signal
          });

          debugLog('Full API response received:', response);
          debugLog('Response usage:', response.usage);
          debugLog('Response finish_reason:', response.choices[0].finish_reason);
          debugLog('Response choices length:', response.choices.length);
          
          const message = response.choices[0].message;
          
          // Extract reasoning if present
          const reasoning = (message as any).reasoning;
          
          // Pass usage data to callback if available
          if (response.usage && this.onApiUsage) {
            this.onApiUsage({
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens
            });
          }
          debugLog('Message content length:', message.content?.length || 0);
          debugLog('Message has tool_calls:', !!message.tool_calls);
          debugLog('Message tool_calls count:', message.tool_calls?.length || 0);
          
          if (response.choices[0].finish_reason !== 'stop' && response.choices[0].finish_reason !== 'tool_calls') {
            debugLog('WARNING - Unexpected finish_reason:', response.choices[0].finish_reason);
          }

          // Handle tool calls if present
          if (message.tool_calls) {
            // Show thinking text or reasoning if present
            if (message.content || reasoning) {
              if (this.onThinkingText) {
                this.onThinkingText(message.content || '', reasoning);
              }
            }

            // Add assistant message to history
            const assistantMsg: Message = {
              role: 'assistant',
              content: message.content || ''
            };
            assistantMsg.tool_calls = message.tool_calls;
            this.messages.push(assistantMsg);

            // Execute tool calls
            for (const toolCall of message.tool_calls) {
              // Check for interruption before each tool execution
              if (this.isInterrupted) {
                debugLog('Tool execution interrupted by user');
                this.currentAbortController = null;
                return;
              }
              
              const result = await this.executeToolCall(toolCall);

              // Add tool result to conversation (including rejected ones)
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });

              // Check if user rejected the tool, if so, stop processing
              if (result.userRejected) {
                // Add a note to the conversation that the user rejected the tool
                this.messages.push({
                  role: 'system',
                  content: `The user rejected the ${toolCall.function.name} tool execution. The response has been terminated. Please wait for the user's next instruction.`
                });
                return;
              }
            }

            // Continue loop to get model response to tool results
            iteration++;
            continue;
          }

          // No tool calls, this is the final response
          const content = message.content || '';
          debugLog('Final response - no tool calls detected');
          debugLog('Final content length:', content.length);
          debugLog('Final content preview:', content.substring(0, 200));
          
          if (this.onFinalMessage) {
            debugLog('Calling onFinalMessage callback');
            this.onFinalMessage(content, reasoning);
          } else {
            debugLog('No onFinalMessage callback set');
          }

          // Add final response to conversation history
          this.messages.push({
            role: 'assistant',
            content: content
          });

          debugLog('Final response added to conversation history, exiting chat loop');
          this.currentAbortController = null; // Clear abort controller
          return; // Successfully completed, exit both loops

        } catch (error) {
          this.currentAbortController = null; // Clear abort controller
          
          // Check if this is an abort error due to user interruption
          if (error instanceof Error && (
            error.message.includes('Request was aborted') ||
            error.message.includes('The operation was aborted') ||
            error.name === 'AbortError'
          )) {
            debugLog('API request aborted due to user interruption');
            // Don't add error message if it's an interruption - the interrupt message was already added
            return;
          }
          
          debugLog('Error occurred during API call:', error);
          debugLog('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available'
          });
          
          // Add API error as context message instead of terminating chat
          let errorMessage = 'Unknown error occurred';
          let is401Error = false;
          
          if (error instanceof Error) {
            // Check if it's an API error with more details
            if ('status' in error && 'error' in error) {
              const apiError = error as any;
              is401Error = apiError.status === 401;
              if (apiError.error?.error?.message) {
                errorMessage = `API Error (${apiError.status}): ${apiError.error.error.message}`;
                if (apiError.error.error.code) {
                  errorMessage += ` (Code: ${apiError.error.error.code})`;
                }
              } else {
                errorMessage = `API Error (${apiError.status}): ${error.message}`;
              }
            } else {
              errorMessage = `Error: ${error.message}`;
            }
          } else {
            errorMessage = `Error: ${String(error)}`;
          }
          
          // For 401 errors (invalid API key), don't retry - terminate immediately
          if (is401Error) {
            throw new Error(`${errorMessage}. Please check your API key and use /login to set a valid key.`);
          }
          
          // Add error context to conversation for model to see and potentially recover
          this.messages.push({
            role: 'system',
            content: `Previous API request failed with error: ${errorMessage}. Please try a different approach or ask the user for clarification.`
          });
          
          // Continue conversation loop to let model attempt recovery
          iteration++;
          continue;
        }
      }

      // Hit max iterations, ask user if they want to continue
      if (iteration >= maxIterations) {
        let shouldContinue = false;
        if (this.onMaxIterations) {
          shouldContinue = await this.onMaxIterations(maxIterations);
        }
        if (shouldContinue) {
          iteration = 0; // Reset iteration counter
          continue; // Continue the outer loop
        } else {
          return; // Exit both loops
        }
      }
    }
  }

  private async executeToolCall(toolCall: any): Promise<Record<string, any>> {
    try {
      // Strip 'repo_browser.' prefix if present (some models hallucinate this)
      let toolName = toolCall.function.name;
      if (toolName.startsWith('repo_browser.')) {
        toolName = toolName.substring('repo_browser.'.length);
      }

      // Handle truncated tool calls
      let toolArgs: any;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        return {
          error: `Tool arguments truncated: ${error}. Please break this into smaller pieces or use shorter content.`,
          success: false
        };
      }

      // Notify UI about tool start
      if (this.onToolStart) {
        this.onToolStart(toolName, toolArgs);
      }

      // Check read-before-edit for edit tools
      if (toolName === 'edit_file' && toolArgs.file_path) {
        if (!validateReadBeforeEdit(toolArgs.file_path)) {
          const errorMessage = getReadBeforeEditError(toolArgs.file_path);
          const result = { error: errorMessage, success: false };
          if (this.onToolEnd) {
            this.onToolEnd(toolName, result);
          }
          return result;
        }
      }

      // Check if tool needs approval (only after validation passes)
      const isDangerous = DANGEROUS_TOOLS.includes(toolName);
      const requiresApproval = APPROVAL_REQUIRED_TOOLS.includes(toolName);
      const needsApproval = isDangerous || requiresApproval;
      
      // For APPROVAL_REQUIRED_TOOLS, check if session auto-approval is enabled
      const canAutoApprove = requiresApproval && !isDangerous && this.sessionAutoApprove;
            
      if (needsApproval && !canAutoApprove) {
        let approvalResult: { approved: boolean; autoApproveSession?: boolean };
        
        if (this.onToolApproval) {
          // Check for interruption before waiting for approval
          if (this.isInterrupted) {
            const result = { error: 'Tool execution interrupted by user', success: false, userRejected: true };
            if (this.onToolEnd) {
              this.onToolEnd(toolName, result);
            }
            return result;
          }
          
          approvalResult = await this.onToolApproval(toolName, toolArgs);
          
          // Check for interruption after approval process
          if (this.isInterrupted) {
            const result = { error: 'Tool execution interrupted by user', success: false, userRejected: true };
            if (this.onToolEnd) {
              this.onToolEnd(toolName, result);
            }
            return result;
          }
        } else {
          // No approval callback available, reject by default
          approvalResult = { approved: false };
        }
        
        // Enable session auto-approval if requested (only for APPROVAL_REQUIRED_TOOLS)
        if (approvalResult.autoApproveSession && requiresApproval && !isDangerous) {
          this.sessionAutoApprove = true;
        }
        
        if (!approvalResult.approved) {
          const result = { error: 'Tool execution canceled by user', success: false, userRejected: true };
          if (this.onToolEnd) {
            this.onToolEnd(toolName, result);
          }
          return result;
        }
      }
    
      // Execute tool
      const result = await executeTool(toolName, toolArgs);

      // Notify UI about tool completion
      if (this.onToolEnd) {
        this.onToolEnd(toolName, result);
      }

      return result;

    } catch (error) {
      const errorMsg = `Tool execution error: ${error}`;
      return { error: errorMsg, success: false };
    }
  }
}


// Debug logging to file
const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-agent.log');
let debugLogCleared = false;
let debugEnabled = false;

function debugLog(message: string, data?: any) {
  if (!debugEnabled) return;
  
  // Clear log file on first debug log of each session
  if (!debugLogCleared) {
    fs.writeFileSync(DEBUG_LOG_FILE, '');
    debugLogCleared = true;
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  fs.appendFileSync(DEBUG_LOG_FILE, logEntry);
}

function generateCurlCommand(apiKey: string, requestBody: any, requestCount: number): string {
  if (!debugEnabled) return '';
  
  const maskedApiKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`;
  
  // Write request body to JSON file
  const jsonFileName = `debug-request-${requestCount}.json`;
  const jsonFilePath = path.join(process.cwd(), jsonFileName);
  fs.writeFileSync(jsonFilePath, JSON.stringify(requestBody, null, 2));
  
  const curlCmd = `curl -X POST "https://api.groq.com/openai/v1/chat/completions" \\
  -H "Authorization: Bearer ${maskedApiKey}" \\
  -H "Content-Type: application/json" \\
  -d @${jsonFileName}`;
  
  return curlCmd;
}