# 🧠 Second Brain Notes
> **Vibethon 2024 Submission**    
> A modern remix of the classic notes app, enhanced with AI to transform how you think and organize knowledge.

Second Brain Notes reimagines traditional note-taking by combining the simplicity of hierarchical outlining with powerful AI integration. It helps you connect ideas, enhance understanding, and stay organized with a clean interface that scales with your thinking.

## 🎯 The Problem
Traditional note-taking apps are passive containers for information. They don't help you:
- Connect related ideas across notes
- Develop thoughts into actionable insights
- Discover hidden patterns in your knowledge
- Maintain focus during deep work sessions

Second Brain Notes solves these challenges by integrating AI directly into your note-taking workflow.

## ✨ Key Features

### Outlining Reimagined
- **Infinite Nesting**: Organize thoughts hierarchically
- **Focus Mode**: Zoom into any node for distraction-free work
- **Real-time Sync**: Automatic saving to Firestore
- **Rich Text**: Bold, italics, underlines, and more

### Smart Organization
- **Notebooks**: Organize notes into dedicated collections for projects, topics, or areas of interest
- **Tags**: Add custom labels to notes for cross-notebook categorization and filtering

### AI-Powered Intelligence
- **Thinking Partner**: Context-aware suggestions as you type
- **Smart Summarization**: Condense complex topics instantly
- **Knowledge Connections**: Discover relationships between notes
- **Semantic Search**: Find content by meaning, not keywords

### Designed for Productivity
- **Clean Interface**: Minimalist design that stays out of your way
- **Keyboard-Centric**: Speed up navigation with shortcuts
- **Export Options**: Save as PDF with preserved formatting
- **Mobile Ready**: Responsive design for all devices

## 🛠️ Technology Stack
- **Next.js 14**: App Router for fast navigation
- **Firebase**: Authentication and real-time database
- **Google Gemini**: Powers AI features
- **Tailwind CSS**: Responsive, modern styling
- **TypeScript**: Type-safe development

## 🌐 Vibethon Relevance
Second Brain Notes is a perfect example of remixing a classic app (notes) with modern innovations:
- **AI Integration**: Transforming passive notes into an active thinking partner
- **Semantic Understanding**: Going beyond keyword search to find meaning
- **User Experience**: Modern interface with focus mode for deep work
- **API Usage**: Integrates Firebase, Google Gemini, and upcoming Google Calendar scheduling for actionable workflows

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm 9+
- Firebase account (for authentication and database)
- Google Cloud account (for Gemini API access)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/your-username/second-brain-notes.git
    cd second-brain-notes
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Configure environment variables:

    Create a `.env.local` file in the root directory with your Firebase and Google Cloud credentials. Example:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    GEMINI_API_KEY=your_gemini_api_key
    ```

4. Start the development server:

    ```bash
    npm run dev
    ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser and start outlining your thoughts!

## 📖 Usage

- Create bullet points by typing and pressing `Enter`.
- Use `Tab` / `Shift+Tab` to nest or outdent items.
- Click bullets to focus in and zoom into ideas.
- Use the sidebar to expand, summarize, or extract action items with AI-powered suggestions.
- Organize notes into notebooks and tag content for cross-referencing.
- Export notes to PDF for sharing or archiving.

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repository, create feature branches, and submit pull requests. We appreciate bug reports, feature requests, and feedback!

## 📧 Contact

For questions or suggestions, open an issue on GitHub or reach out to us at:  
📩 **suryathekkini@gmail.com**

---

MIT License – Built for focused work and clear thinking.