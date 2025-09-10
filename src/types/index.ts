export interface NoteNode {
  id: string;
  content: string;
  children: NoteNode[];
  parentId?: string;
  // Checklist support
  isChecklist?: boolean;
  checked?: boolean;
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: 'sm' | 'base' | 'lg' | 'xl';
  };
  collapsed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  userId: string;
  rootNodes: NoteNode[];
  notebookId?: string | null;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Notebook {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AISkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
}
