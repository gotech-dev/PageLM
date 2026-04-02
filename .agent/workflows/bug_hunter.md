---
description: Automated Bug Analysis and Fixing Protocol (The "Bug Hunter" Pipeline)
---

# Bug Hunter Workflow

This workflow automates the process of identifying, reproducing, and fixing bugs using a Test-Driven approach.

## Phase 1: Reproduction (Role: QA)
**Input**: Bug description, Logs, or Screenshot.
**Action**:
1.  **Analyze**: Look at the current code to understand the logic.
2.  **Write Test (The "Trap")**:
    - Create a **failing test case** (Unit or Widget test) that reproduces the bug.
    - *Goal*: The test MUST fail. If it passes, you haven't reproduced the bug.
    - Reference `.agent/skills/testing/SKILL.md` for test syntax.

## Phase 2: Diagnosis (Role: Researcher)
**Condition**: Test in Phase 1 is failing.
**Action**:
1.  **Search**: If the error is obscure, use `search_web` to find similar issues (StackOverflow, Github Issues).
2.  **Hypothesize**: Propose a fix (e.g., "Memory leak due to unclosed stream" or "Null pointer in API response").

## Phase 3: Fix (Role: Engineer)
**Action**:
1.  **Apply Fix**: Edit the code to resolve the issue.
2.  **Standards**: Ensure the fix follows `SKILL.md` (e.g., Error handling patterns).

## Phase 4: Verification (Role: QA)
**Action**:
1.  **Run Test**: Run the test created in Phase 1.
2.  **Success Condition**: The test must now **PASS**.
3.  **Regression Check**: Run related tests to ensure no side effects.

## Triggering
Use `/fix "Description of bug"` to start this pipeline.
