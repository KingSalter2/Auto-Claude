# GitHub Issues Documentation Design

**Date:** 2025-02-16
**Status:** Approved
**Author:** Claude (Superpowers Brainstorming)

## Overview

Create comprehensive, user-friendly documentation for Auto Claude's GitHub Issues integration. The documentation will serve a mixed audience (new and existing users) with progressive depth across three documents.

## Target Audience

**Mixed audience with progressive depth:**
- **End users** - New to Auto Claude, want to understand features and get started quickly
- **Technical users** - Existing users wanting to optimize AI configuration and manage costs
- **Pro users/developers** - Want to customize prompts, context injection, and extend the system

## Document Structure

### New Directory: `guides/github-issues/`

```
guides/
└── github-issues/
    ├── README.md                                    # Navigation index
    ├── github-issues-user-guide.md                  # Document 1
    ├── github-issues-advanced-ai-configuration.md   # Document 2
    └── github-issues-customization-guide.md         # Document 3
```

### Document 1: User Guide

**Audience:** End users (non-technical)
**Focus:** Features, workflows, getting started

**Sections:**
1. **Overview** - What is GitHub Issues integration? Why use it?
2. **Quick Start (5 minutes)** - Get your first issue investigated end-to-end
3. **Key Features** - Bullet points of main capabilities
4. **Integration Workflow** - Import → Investigate → Create Task → Implement (EMPHASIS)
5. **Setup & Configuration** - GitHub authentication, connecting repos
6. **Using the Features**
   - Importing & browsing issues
   - Running AI investigations
   - Creating tasks from results
   - Posting findings back to GitHub
7. **FAQ** - Common questions

**Tone:** Friendly, encouraging, approachable. Plain English with minimal jargon.

### Document 2: Advanced AI Configuration

**Audience:** Technical users, team leads
**Focus:** AI tuning, performance, cost management

**Sections:**
1. **Overview** - Who this guide is for
2. **Opus 4.6 Features** - Fast Mode, 128K tokens, adaptive thinking
3. **The 4 Specialist Agents** - Deep dive into each agent's role
4. **Pricing & Cost Management** - Token limits, cost optimization strategies
5. **Advanced Configuration** - Per-specialist settings, performance tuning
6. **Technical Architecture** - How investigation works under the hood

**Tone:** Professional, technical but clear. Explains technical concepts in context.

### Document 3: Customization Guide

**Audience:** Developers, pro users extending Auto Claude
**Focus:** System customization, prompts, context injection

**Sections:**
1. **Overview** - Who this is for (developers extending Auto Claude)
2. **Prompt System Architecture** - How agent prompts are structured
3. **Context Injection System** - How context is built and passed to agents
4. **Customizing Agent Prompts** - Modifying XML prompt files
   - Finding the prompt files
   - Prompt structure and variables
   - Creating custom investigation specialists
5. **Context Configuration** - Customizing what data is included
   - File selection patterns
   - Context window management
   - Repository context settings
6. **Adding Custom Specialists** - Creating new investigation agents
7. **Extending the Integration** - Hooks, custom providers
8. **Examples & Recipes** - Common customizations

**Tone:** Developer-to-developer, technical, code-heavy, minimal hand-holding.

## Content Approach

### Progressive Disclosure
- Each document builds on the previous one
- Clear navigation links between documents
- Users can enter at their appropriate level

### Writing Style Guidelines

| Document | Tone | Language | Example Style |
|----------|------|----------|---------------|
| User Guide | Friendly, encouraging | Plain English | "Think of AI investigation as having a senior developer analyze the issue for you" |
| Advanced Config | Professional, technical | Terms explained in context | "Fast Mode uses optimized token generation to reduce investigation time by 2.5x" |
| Customization | Developer-to-developer | Technical, code-heavy | "Modify the `<system_context>` variable in `prompts/github/root_cause.xml`" |

### Code & Configuration Examples
- **Doc 1:** Simple copy-paste examples, UI navigation
- **Doc 2:** Configuration snippets, environment variables
- **Doc 3:** Full XML/Python examples, file paths, code blocks

## Visual Elements

### Screenshots (Hybrid Approach)

**User Guide:**
1. GitHub Issues main UI (issue list, filters, actions)
2. Issue detail view (comments, labels, "Investigate" button)
3. Investigation in progress (4 parallel specialists)
4. Investigation results (completed report)
5. Settings screen (GitHub auth, repo connection, Fast Mode toggle)

**Advanced AI Config:**
1. Settings → AI Investigation panel (configurable options)
2. Token usage display (cost visibility)
3. Investigation pipeline flowchart (issue → 4 specialists → report)

**Customization Guide:**
1. Directory structure diagram (prompt file locations)
2. Annotated XML prompt file (variables and structure)
3. Context injection flow diagram
4. Code snippets throughout

### Diagram Style
- Clean, simple flowcharts
- Consistent color scheme: Blue (user actions), Green (AI agents), Orange (data flow)
- Minimal text, focus on flow and relationships

## Navigation & Cross-References

### Linking Strategy

**User Guide → Deeper:**
- "For detailed configuration, see [Advanced AI Configuration]"
- "Learn how the 4 specialists work in [Advanced AI Configuration]"
- "Want to customize agent behavior? See [Customization Guide]"

**Advanced AI Config → Both Directions:**
- "New to GitHub Issues? Start with the [User Guide]"
- "Want to modify agent prompts? See [Customization Guide]"

**Customization Guide → Reference:**
- "Assumes familiarity with concepts from [User Guide] and [Advanced AI Config]"

### Navigation Aids
- Table of Contents at the top of each document
- "In this section" callouts at the start of major sections
- "Next steps" boxes at the end of each workflow section

### External References
- `guides/opus-4.6-features.md` - Opus 4.6 details (don't duplicate)
- `ARCHITECTURE.md` - System architecture
- GitHub CLI docs - Authentication setup

## Key Emphasis

**Integration Workflow** is the primary focus across all documents:

> **Import Issues** → **AI Investigation** → **Create Task** → **Implement** → **Merge**

This pipeline demonstrates the core value of Auto Claude - connecting GitHub issues to autonomous development.

## File Organization

### Naming Convention
- Lowercase with hyphens (matches existing documentation style)
- Descriptive names indicating audience and content
- Keep under 80 characters for GitHub rendering

### README.md (Index Page)

```markdown
# GitHub Issues Documentation

Choose the guide that matches your needs:

📖 **[User Guide](github-issues-user-guide.md)** - Get started with GitHub Issues integration
  For: All users | Focus: Using the features

⚙️ **[Advanced AI Configuration](github-issues-advanced-ai-configuration.md)** - Optimize AI investigations
  For: Technical users | Focus: Performance, costs, Opus 4.6

🔧 **[Customization Guide](github-issues-customization-guide.md)** - Extend and customize the system
  For: Developers | Focus: Prompts, context, customization
```

## Markdown Format Guidelines

- Standard GitHub-flavored markdown
- H1 for title, H2 for main sections, H3 for subsections
- Code blocks with language specification (`xml`, `python`, `bash`)
- Callout boxes using `> **Note:**` format
- Internal links use relative paths
- Front matter with title and description metadata

## Implementation Notes

### Content Sources
- `apps/frontend/src/renderer/components/github-issues/` - UI components
- `apps/frontend/src/main/ipc-handlers/github/` - IPC handlers
- `apps/backend/runners/github/` - Backend services
- `guides/opus-4.6-features.md` - Reference for Opus 4.6 details
- Existing code comments and docstrings

### Screenshots to Capture
- Need to run the application in development mode (`npm run dev`)
- Capture each UI state listed in Visual Elements section
- Save to `guides/github-issues/images/` with descriptive names

### Diagram Creation
- Use Mermaid syntax for flowcharts (if supported by docs build)
- Alternatively, describe for manual creation with diagram tools

## Success Criteria

1. ✅ All three documents created in `guides/github-issues/`
2. ✅ README.md index page created
3. ✅ Progressive structure allows users to enter at appropriate level
4. ✅ Integration workflow is clear and emphasized
5. ✅ Screenshots included for key UI states
6. ✅ Cross-references enable navigation between documents
7. ✅ Writing style matches target audience for each document
8. ✅ Content is accurate based on actual codebase features

## Next Steps

1. Create implementation plan using writing-plans skill
2. Set up directory structure
3. Draft content for each document
4. Capture screenshots
5. Create diagrams
6. Review and refine
7. Commit to repository
