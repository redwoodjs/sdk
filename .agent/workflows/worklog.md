---
description: Generate a worklog
---

Generate a technical worklog for this session, place this in @/.notes/<username>/worklogs/<YYYY-MM-dd-HHMM>-<slug>.md

Be concise. Use simple language.

Use the following Markdown structure:

---
title: [Short descriptive title]
date: 2026-01-20 15:38
author: <username>
---

# [Title]

## Summary
A brief overview of what we investigated and the final outcome.

## The Problem
What was the specific bug, technical hurdle, or goal we started with? Include any error messages or unexpected behaviors.

## Investigation & Timeline
* **Initial State:** Describe the code/environment at the start.
* **Attempts:** * List what we tried.
    * Use code blocks for snippets tested.
    * Note what failed and why (e.g., "Tried X, but it caused a hydration mismatch").

## Discovery & Key Findings
What did we learn about the system or the underlying logic during this chat?

## Resolution
The final code or solution we landed on.

## Next Steps
- [ ] Action item 1
- [ ] Action item 2