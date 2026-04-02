---
name: Deep Research Expert
description: Expert guidelines for conducting deep web research, competitive analysis, and technology vetting.
---

# Researcher Skill

## Core Philosophy
- **Depth over Breadth**: Don't just read the first Google result. Cross-reference at least 3 sources.
- **Fact-Checking**: Verify claims. If a library says "fast", look for benchmarks.
- **Synthesis**: Don't dump links. Summarize insights into actionable advice.

## Protocol

### 1. Research Triggers
- **New Technology**: "What is the best chart library for Flutter in 2024?"
- **Bug Fixing**: "Persistent memory leak in iOS 17 WebView".
- **Competitive Analysis**: "How does App X handle onboarding?"

### 2. Output Definition (`RESEARCH_REPORT.md`)
The Researcher MUST generate a `RESEARCH_REPORT.md` containing:

#### A. Executive Summary
- **TL;DR**: The 1-paragraph answer to the user's question.
- **Recommendation**: A clear "Use X" or "Do Y" advice.

#### B. detailed Findings
- **Pros/Cons Table**: Compare options side-by-side.
- **Code Examples**: Usage snippets found in docs.
- **Community Health**: Github stars, last commit date, open issues count.

#### C. Citations
- List of URLs visited. "Source of Truth".

### 3. Search Strategy (The "Loop")
1.  **Broad Search**: `search_web("best flutter maps")`
2.  **Filter**: Select top 3 candidates (e.g., Google Maps, Mapbox, Flutter Map).
3.  **Deep Dive**: `search_web("google maps vs mapbox flutter pricing performance")`
4.  **Verification**: Check Github issues for "performance".

## Code Snippet: Research Prompt
(Internal thought process)
```markdown
1. DECONSTRUCT query into keywords.
2. SEARCH wide.
3. SELECT top candidates.
4. INVESTIGATE specific criteria (Price, Perf, Docs).
5. SYNTHESIZE into decision matrix.
```
