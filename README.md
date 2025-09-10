# Second Brain Notes

An intelligent note-taking application that acts as your true "second brain" - combining hierarchical outlining with AI-powered thinking partnership.

## Overview

This is a modern take on the classic hierarchical outliner (Dynalist/Workflowy style), refined for clarity and speed, and enhanced with:

- **AI Thinking Partner**: Context-aware AI that helps you elaborate, challenge ideas, and synthesize information
- **Action Engine**: Google Calendar integration that transforms notes into actionable outcomes
- **Semantic Knowledge Retrieval**: AI-powered search that understands meaning, not just keywords

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

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Firebase Firestore (Spark Plan)
- **Authentication**: Firebase Auth with Google Sign-In
- **AI**: Google Gemini 1.5 Flash API
- **Hosting**: Vercel (Hobby Plan)

## Getting Started

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd second-brain-notes
   npm install
   ```

2. **Environment Setup**
   Copy `.env.local` and fill in your API keys:
   ```bash
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Gemini AI API Key
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Firebase Setup**
   - Create a Firebase project
   - Enable Firestore Database
   - Enable Authentication with Google provider
   - Add your domain to authorized domains

4. **Gemini API Setup**
   - Get API key from Google AI Studio
   - Add to environment variables

5. **Run Development Server**
   ```bash
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

## Architecture

```
src/
├── app/
│   ├── api/ai/          # Gemini API proxy
│   ├── globals.css      # Tailwind + custom styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main app page
├── components/
│   ├── AuthProvider.tsx # Firebase auth context
│   ├── NotesEditor.tsx  # Core hierarchical editor
│   └── AISidebar.tsx    # AI chat interface
├── lib/
│   ├── firebase.ts      # Firebase configuration
│   └── noteService.ts   # Firestore operations
└── types/
    └── index.ts         # TypeScript definitions
```

## Security

- API keys stored as Vercel environment variables
- Firebase security rules protect user data
- All external API calls routed through secure serverless functions
- No client-side exposure of sensitive credentials

## Roadmap

This project follows a precise timeline with high-quality implementations:

- **Sept 9-13**: MVP with core editor, Firebase, and basic AI
- **Sept 14-18**: Calendar integration and semantic search
- **Sept 19**: Final polish and demo

## License

MIT License - Built for focused work and clear thinking.
