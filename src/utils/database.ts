// FILE: src/utils/database.ts

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { ChatMessage } from '../ui/hooks/useAgent.js';

type DbMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_execution';
  content: string;
  reasoning: string | null;
  tool_execution_json: string | null;
  timestamp: string;
};

const DB_DIR = path.join(os.homedir(), '.groq');
const DB_PATH = path.join(DB_DIR, 'history.db');

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    fs.mkdirSync(DB_DIR, { recursive: true });
    this.db = new Database(DB_PATH);
    this.init();
  }

  private init(): void {
    const createTableStmt = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning TEXT,
        tool_execution_json TEXT,
        timestamp TEXT NOT NULL
      );
    `;
    this.db.exec(createTableStmt);
  }

  public getMessages(): ChatMessage[] {
    const stmt = this.db.prepare('SELECT * FROM messages ORDER BY timestamp ASC');
    const dbMessages = stmt.all() as DbMessage[];

    return dbMessages.map(row => ({
      ...row,
      reasoning: row.reasoning ?? undefined,
      timestamp: new Date(row.timestamp),
      toolExecution: row.tool_execution_json ? JSON.parse(row.tool_execution_json) : undefined,
    }));
  }

  public addMessage(message: ChatMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, role, content, reasoning, tool_execution_json, timestamp)
      VALUES (@id, @role, @content, @reasoning, @tool_execution_json, @timestamp)
    `);
    stmt.run({
      id: message.id,
      role: message.role,
      content: message.content,
      reasoning: message.reasoning ?? null,
      tool_execution_json: message.toolExecution ? JSON.stringify(message.toolExecution) : null,
      timestamp: message.timestamp.toISOString(),
    });
  }

  public clearHistory(): void {
    this.db.exec('DELETE FROM messages');
  }
}

export const dbManager = new DatabaseManager();
