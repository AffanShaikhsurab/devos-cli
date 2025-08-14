// FILE: src/utils/project-context.ts

import * as path from 'path';
import * as fs from 'fs-extra';

export class ProjectContext {
  public projectRoot: string;
  public bmadDir: string;
  public implementationsDir: string;
  public learningsDir: string;
  public docsDir: string;
  public prdDir: string;
  public archDir: string;
  public storiesDir: string;

  constructor() {
    // Assume the CLI is run from the project's root directory
    this.projectRoot = process.cwd();
    this.bmadDir = path.join(this.projectRoot, '.bmad');

    // Define all project-local paths
    this.implementationsDir = path.join(this.bmadDir, 'implementations');
    this.learningsDir = path.join(this.bmadDir, 'learnings');
    this.docsDir = path.join(this.bmadDir, 'docs');
    this.prdDir = path.join(this.docsDir, 'prd');
    this.archDir = path.join(this.docsDir, 'architecture');
    this.storiesDir = path.join(this.docsDir, 'stories');
  }

  // This method ensures the entire directory structure exists.
  public initializeDirectories(): void {
    fs.ensureDirSync(this.implementationsDir);
    fs.ensureDirSync(this.learningsDir);
    fs.ensureDirSync(this.prdDir);
    fs.ensureDirSync(this.archDir);
    fs.ensureDirSync(this.storiesDir);
  }
}

// Export a single instance for the whole application to use
export const projectContext = new ProjectContext();
