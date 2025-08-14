export interface ToolResult {
  success: boolean;
  content?: any;
  data?: any;
  message?: string;
  error?: string;
}

export function createToolResponse(success: boolean, data?: any, message: string = '', error: string = ''): ToolResult {
  const response: ToolResult = { success };

  if (success) {
    if (data !== undefined) {
      response.content = data;
    }
    if (message) {
      response.message = message;
    }
  } else {
    response.error = error;
    if (message) {
      response.message = message;
    }
  }

  return response;
}
