---
description: High-fidelity image-to-code conversion using 3-Phase Visual Replication Protocol
---

# Image to Code Workflow

This workflow enforces a strict "Visual Replication Protocol" to ensure pixel-perfect UI generation from images.

## Phase 1: Visual Decomposition (The Design Spec)

**Step 1: Calibration**
Ask the user for *one* known dimension to act as an anchor (e.g., "What is the width of this screen?" or "What is the font size of the body text?").
*If the user provides no answer, assume a standard mobile width of 375px.*

**Step 2: Extract Global Tokens**
Analyze the image and extract the following into a JSON block:
- **Palette**: Exact Hex codes for Primary, Secondary, Background, Surface, TextColors (Primary/Secondary).
- **Typography**: Estimated Font Family, Weight Ramp (300/400/500/600/700), and Size Ramp (12, 14, 16, 20, 24, 32...).
- **Spacing**: The base grid unit (likely 4px, 8px, or 12px).
- **Radius**: Standard border-radius values (4px, 8px, 16px, 100px).

**Step 3: Define Layout Topology**
Describe the widget/component tree without writing code.
Example:
```
Scaffold
  |_ Column
      |_ Header (Row: [Icon, Text, Spacer, Icon])
      |_ List (ListView)
          |_ Card (Container + Rounded + Shadow)
```

## Phase 2: Tech Stack Mapping

**Step 4: Skill Check**
Read the relevant `SKILL.md` (e.g., `.agent/skills/flutter/SKILL.md`) to align with the project's coding standards.

**Step 5: Map Tokens to Code**
Create a "Mapping Table":
- Image "Soft Shadow" -> Code: `BoxShadow(color: Color(0x1A000000), blurRadius: 10, offset: Offset(0, 4))`
- Image "Gradient Button" -> Code: `Container(decoration: BoxDecoration(gradient: LinearGradient(...)))`

## Phase 3: Component Assembly & Self-Correction

**Step 6: Atomic Implementation**
Write the code for the smallest reusable components first (Atoms).

**Step 7: Assembly**
Compose the screen using the Atoms.

**Step 8: Self-Correction (Critical)**
// turbo
Before finishing, perform a "Mental Diff":
1.  Compare the Generated Code's likely output vs. the Original Image.
2.  Check alignment, padding, and font weights.
3.  **Fix any discrepancies immediately.**

**Final Output**
Present the final code to the user.
