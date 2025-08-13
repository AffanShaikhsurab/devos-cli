# Quality Assurance Review Task

## Purpose
To meticulously review a completed development story, validate its correctness against all requirements, and, upon approval, generate comprehensive, structured documentation in the `implementations/` directory and update the master index.

## CONTEXT
- You will be given the path to a story file that the `dev` agent has marked as complete.

## SEQUENTIAL Task Execution

### 1. Review Story and Code
- **Action:** Read the provided story file in its entirety. Pay close attention to the "Story" description, all "Acceptance Criteria," and the list of changed files in the "File List" section.
- **Tool:** `read_file`

### 2. Validate Implementation
- **Action:** Systematically compare the implemented code in the changed files against each acceptance criterion to ensure all requirements are met. Scrutinize the logic for correctness and adherence to project standards.
- **Action:** If test execution instructions are available in the story or project `README.md`, run all relevant tests to ensure they pass.
- **Tool:** `execute_command` (e.g., `npm test`)
- **Decision:**
    - If the code is incorrect, tests fail, or it does not meet all criteria: **Report the specific failures**. Then, you MUST automatically invoke the `/dev` command on the story file again, including your rejection notes as context for the `dev` agent to fix the issues. State that the story is **REJECTED** and has been returned to development. **HALT EXECUTION** of the QA task.
    - If everything is correct and all tests pass: Proceed to the next step.

### 3. Generate Implementation Documentation
- **Action:** If validation is successful, create the structured documentation for the `implementations/` folder.
- **Get Story ID & Title:** Extract the unique story ID (e.g., "1.2") and Title from the story file.
- **Create Story Folder:** Create a new directory inside `implementations/` named after the story ID (e.g., `implementations/1.2/`).
- **Create Notes File:** Inside the new folder, create a single file named `implementation_notes.md`.
- **Tool:** `create_file`

### 4. Populate the `implementation_notes.md` File
- **Action:** The content for this file MUST start with a YAML frontmatter block containing key metadata, followed by the detailed markdown notes.
- **Tool:** `edit_file`
- **Exact Content Structure:**
    ```markdown
    ---
    story_id: "<STORY_ID>"
    title: "<STORY_TITLE>"
    date_completed: "<CURRENT_DATE>"
    summary: "<A 1-2 sentence summary of the implementation.>"
    technologies:
      - "<Technology_1>"
      - "<Technology_2>"
    key_files_changed:
      - path: "<path/to/file1.ts>"
        purpose: "<Purpose of this file's change.>"
      - path: "<path/to/file2.ts>"
        purpose: "<Purpose of this file's change.>"
    ---

    # Implementation Notes for Story <STORY_ID>: <STORY_TITLE>

    ## Detailed Explanation
    A detailed, paragraph-form explanation of what was implemented and how it works.

    ## Reasoning for Changes
    The reasoning behind the specific file additions or changes. Explain *why* the implementation was done this way, referencing architectural decisions if necessary.

    ## Full List of Modified/Added Files
    - **`<path/to/file1.ts>`** (Created/Modified): Purpose of this file's change.
    - **`<path/to/file2.ts>`** (Created/Modified): Purpose of this file's change.
    ```

### 5. Update the Master `index.yaml`
- **Action:** Read the main `implementations/index.yaml` file.
- **Action:** Add a new, concise entry to the `completed_stories` list, using the information from the frontmatter you just created.
- **Tool:** `read_file`, then `edit_file`.
- **Example new `index.yaml` content:**
    ```yaml
    completed_stories:
      - id: "1.2"
        title: "User Authentication Endpoint"
        summary: "Implemented the POST /api/login endpoint using JWT for authentication."
        path: "implementations/1.2/"
        date: "2025-08-13"
    ```

### 6. Final Report
- **Action:** Report to the user that the story has successfully passed QA and that the implementation has been documented according to the required standard.
