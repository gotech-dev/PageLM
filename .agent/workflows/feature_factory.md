---
description: Automated Feature Implementation Workflow (The "Factory" Pipeline)
---

# Feature Factory Workflow

This workflow automates the cycle from "Raw Requirement" to "Verified Code", mimicking a full product team (PM -> Dev -> QA).

## Phase 1: Requirement Analysis (Role: Product Manager)
**Input**: Raw text, PDF content, or user description.
**Action**:
1.  **Analyze**: Use the `requirement_analysis` skill to extract Entities, User Stories, and Acceptance Criteria.
2.  **Draft PRD**: Create/Update `SPECIFICATION.md` in the feature folder.
    - *Prompt*: "Act as a MetaGPT Product Manager. Break this requirement down into a PRD with Product Goals, User Stories, and a prioritized Requirement Pool."

## Phase 2: Architecture & Research (Role: Architect + Researcher)
**Action**:
1.  **Deep Research (Optional)**:
    - If tech is unknown, use `researcher` skill. Output `RESEARCH_REPORT.md`.
2.  **System Design**:
    - Consult `.agent/skills/architect/SKILL.md`.
    - Generate `DESIGN_DOC.md` (Schema, API, Structure).
    - Create `DIRECTORY_MAP.md` (Files to be created).
3.  **Task Breakdown**:
    - Populate `task.md` with granular engineering tasks.

## Phase 2.5: Approval Gate (CRITICAL)
**Action**:
1.  **Stop**: Do NOT proceed to coding yet.
2.  **Report**: Call `notify_user`.
    - Present the `SPECIFICATION.md` and `DESIGN_DOC.md` for review.
    - Ask: "Here is the Plan & Design. Shall I proceed to build?"

## Phase 3: Implementation (Role: Engineer)
**Condition**: User must have approved Phase 2.5.
**Action**:
1.  **Execute**: Code the feature following `SKILL.md` (Flutter/NextJS/etc).
2.  **Unit Tests**: Write unit tests *alongside* code (TDD).
3.  **Visual Check**: If UI, self-correct against design specs.

## Phase 4: Verification (Role: QA)
**Action**:
1.  **Automated Test**: Run the tests.
2.  **Integration**: Verify impacts on other modules.

## Phase 5: Documentation (Role: Technical Writer)
**Action**:
1.  **Docs**: Update `README.md` and generate `docs/API.md` or `docs/GUIDE.md`.
2.  **Final Report**: Update `walkthrough.md`.

## Triggering
Use `/feature "Description"` to start this pipeline.
