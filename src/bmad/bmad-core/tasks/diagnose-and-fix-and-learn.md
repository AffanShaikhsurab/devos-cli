# Diagnose, Fix, and Learn Task

## Purpose
To systematically analyze a failed code implementation by first checking for known solutions in the `learnings/` folder, then identifying the root cause of new errors, proposing a targeted patch, and finally documenting the new solution as a permanent learning.

## CONTEXT
- You will be given the path to a story file that failed during implementation.
- You will receive the error logs or a description of the failure from the previous step.

## SEQUENTIAL Task Execution

### 1. Check for Known Solutions
- **Action:** Analyze the provided error log. Formulate a concise, searchable summary of the error (e.g., "TypeError: cannot read properties of undefined").
- **Action:** Search through all `.yaml` files in the the project's local `.bmad/learnings/` directory. For each file, read its `error_summary` field to see if it matches the current problem.
- **Tool:** `list_files`, `read_file`
- **Decision:**
    - If a matching solution is found in a learning file: Report the finding and the stored solution to the user. Use the `successful_solution.patch` from the YAML file to formulate an `edit_file` tool call. **Proceed directly to Step 4: Propose the Patch**.
    - If no matching solution is found: Inform the user that this is a new issue and proceed to the next step.

### 2. Root Cause Hypothesis (for new errors)
- **Action:** Review the story file, the modified code specified in the story's "File List", and the error logs to form a clear hypothesis about the root cause of the failure.
- **Tool:** `read_file`
- **Action:** State your hypothesis clearly.
- **Example:** "Hypothesis: The failure is a null reference exception in `user-service.ts` on line 42 because the `user` object is not being properly initialized before its properties are accessed."

### 3. Develop a Minimal Patch
- **Action:** Based on your hypothesis, develop a specific, minimal code change to fix the error.
- **Action (Internal Thought Process):** Consider and internally document any alternative fixes you considered but discarded. This will be used for the `failed_attempts` field in the learning file.

### 4. Propose the Patch
- **Action:** Present the proposed `edit_file` tool call to the user for explicit approval. Do NOT execute the tool yet.

### 5. Create a Verification Plan
- **Action:** Describe precisely how you will verify that the patch works and does not cause regressions.
- **Tool:** `execute_command` to run project tests (e.g., `npm test`).

### 6. Document the New Learning
- **Action:** After the patch is approved by the user and verified, document the new solution.
- **Action:** Create a new YAML file in the `learnings/` directory. The filename should be a unique ID, like a timestamp, followed by a descriptive slug (e.g., `learnings/1691900000-null-pointer-fix.yaml`).
- **Tool:** `create_file`
- **Content for learning file:** The file MUST be a YAML file with the following structured content:
    ```yaml
    id: 1691900000
    error_summary: "Null reference exception in user-service.ts on line 42 when accessing user properties."
    root_cause: "The user object was not being checked for null after being retrieved from the database, leading to an error when an invalid user ID was provided."
    failed_attempts:
      - attempt: "Added a try-catch block around the entire function."
        reason_for_failure: "This caught the error but did not fix the underlying logic bug and returned a generic 500 error instead of a specific 404 Not Found."
    successful_solution:
      description: "Added a null check for the user object immediately after the database query. If the user is null, return a 404 error response to terminate the request gracefully."
      patch:
        tool: "edit_file"
        file_path: "src/services/userService.ts"
        old_text: "const user = await db.findUser(id);"
        new_text: |
          const user = await db.findUser(id);
          if (!user) {
            return res.status(404).send({ error: 'User not found' });
          }
    ```

### 7. Final Report
- **Action:** Report to the user that the repair was successful and a new learning has been saved to the knowledge base, which will prevent this issue from needing to be solved again in the future.
