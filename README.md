# Second Brain Notes

Think in outlines. Capture fast. Zoom into ideas. Second Brain Notes blends the speed of an outliner with a clean, modern UI and an optional AI thinking partner when you want it.

## Overview

A modern take on the classic hierarchical outliner (Dynalist/Workflowy style), refined for clarity and speed, and enhanced with:

- **AI Thinking Partner**: Context-aware AI that helps you elaborate, challenge ideas, and synthesize information
- **Action Engine**: Google Calendar integration that transforms notes into actionable outcomes
- **Semantic Knowledge Retrieval**: AI-powered search that understands meaning, not just keywords

## How it Works

- **Outliner-first editor**
  - Every line is a node. Press Enter to create, Tab/Shift+Tab to change depth.
  - Click a node with children to focus in. Breadcrumbs let you jump back out.
  - Inline formatting: bold/italic/underline/strikethrough and adjustable inline sizes.

- **Persistence & sync**
  - Notes auto-save to Firestore as you type. Each user sees only their notes.
  - Left panel groups notes by recency (Today, Yesterday, Last 7/30 Days, Older) with smooth, themed scrolling.

- **AI assistant (optional)**
  - The right sidebar acts as a thinking partner that works off your current context.
  - Ask it to expand, summarize or extract action items while you outline.

- **Export**
  - One-click “Download PDF” exports your current note section with preserved formatting.

- **Mobile & layout**
  - On small screens, sidebars become slide-in drawers so the editor remains the primary typing surface.

## Features

### Core
- Infinitely nested bullet points with Tab / Shift+Tab
- Focus mode with breadcrumbs (zoom into any node)
- Clean indent guides for rapid visual parsing
- Realtime sync via Firebase Firestore; Google sign-in
- Elegant, responsive UI with glass surfaces and subtle motion
- Export to PDF with formatting (bold/italic/underline/strikethrough, sizes)

### AI
- Context-aware “thinking partner” in the right sidebar
- Expand, summarize, extract action items; grounded by your current note

### Planned
- Calendar integration: natural language → schedule blocks
- Bi-directional linking with [[Note Title]] and backlinks
- Semantic search across your graph using Gemini

## APIs & Services

- **Next.js 14 (App Router)** — UI, routing and serverless API endpoints.
- **Firebase Firestore** — Stores notes (hierarchical nodes) per user; autosave on change.
- **Firebase Auth (Google Sign-In)** — Authenticates users; notes are scoped to your account.
- **Google Gemini 1.5 Flash** — Powers the AI sidebar via a server API route. Your prompts are handled server-side.

## Getting Started

Clone, install dependencies, run the dev server:

```bash
git clone <repository-url>
cd second-brain-notes
npm install
npm run dev
```

## Usage

### Basic Note-Taking
- Type to create bullet points
- Press `Enter` to create new bullets
- Use `Tab` to indent, `Shift+Tab` to outdent
- Click bullets with children to focus (zoom in)

### AI Thinking Partner
- Use quick actions in the sidebar:
  - **Expand**: Get detailed explanations
  - **Summarize**: Create concise summaries
  - **Extract Actions**: Find actionable tasks
- Or chat freely for brainstorming and idea development

### Focus Mode
- Click any bullet point with nested content
- Navigate with breadcrumbs
- Perfect for managing complex hierarchies

### Keyboard Shortcuts
- Enter — New bullet
- Tab / Shift+Tab — Indent / Outdent
- Ctrl/Cmd+B, I, U — Bold, Italic, Underline
- Ctrl/Cmd+Shift+X or Alt+Shift+5 — Strikethrough
- Alt+Left / Alt+Right — Outdent / Indent structurally
- Up/Down at start/end — Navigate bullets


## License

MIT License - Built for focused work and clear thinking.
