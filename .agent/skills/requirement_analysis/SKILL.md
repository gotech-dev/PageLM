---
name: Requirement Analysis Expert
description: Expert guidelines for parsing unstructured requirements (PDF/Docs) into technical specifications.
---

# Requirement Analysis Skill

## Core Philosophy
- **No Ambiguity**: Convert "I want it to look good" into "Use the Design System standard padding and colors".
- **Structured Output**: Always produce a list of **User Stories** and **Acceptance Criteria**.
- **Edge Case Hunter**: Aggressively identifying "what if" scenarios (e.g., No internet? Bad data?).

## Protocol

### 1. Input Processing
- When given a raw text or document, identify:
    - **Actors**: Who is using the feature? (Admin, User, Guest).
    - **Entities**: What data objects are involved? (Product, Cart, UserProfile).
    - **Flows**: What is the sequence of actions?

### 2. Output Format (The "Spec")
Generate a `SPECIFICATION.md` block containing:

#### A. User Stories
Format: `As a <role>, I want to <action>, so that <benefit>.`
- *Example*: "As a User, I want to login via Google, so that I can access my account quickly."

#### B. Acceptance Criteria (Gherkin-style preferred)
- **Given** [Initial Context]
- **When** [Action Performed]
- **Then** [Expected Result]

#### C. Data Schema (Draft)
```json
{
  "user_id": "string",
  "login_provider": "google | email"
}
```

### 3. Gap Detection
- Explicitly list **"Questions for the User"** if logic is missing.
- *Example*: "What happens if the Google Token is expired?"

## Example: Complex Doc to Spec
**Input**: "We need a leaderboard where users win points. Reset every week."

**Output**:
1.  **Entity**: `LeaderboardEntry` (User, Points, WeekId).
2.  **Job**: `WeeklyResetJob` (Cron every Sunday 00:00).
3.  **User Story**: "As a Player, I want to see my rank, so I can compete."
4.  **Edge Case**: "What happens if two users have the same score?" (Tie-breaking rules).

## Code Snippet: Analysis Prompt
(Internal thought process for the Agent)
```markdown
1. READ input.
2. EXTRACT Nouns (Entities) and Verbs (Actions).
3. MAP to User Story format.
4. VALIDATE against "INVEST" criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable).
```
