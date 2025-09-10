import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore/lite';
import { db } from './firebase';
import { Note, NoteNode, Notebook } from '@/types';

export async function saveNote(userId: string, noteId: string, note: Note): Promise<void> {
  const noteRef = doc(db, 'notes', `${userId}_${noteId}`);
  await setDoc(noteRef, {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
    rootNodes: serializeNodes(note.rootNodes),
  });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const noteRef = doc(db, 'notes', `${userId}_${noteId}`);
  await deleteDoc(noteRef);
}

// Update partial note metadata (tags, notebook assignment)
export async function updateNoteMeta(
  userId: string,
  noteId: string,
  patch: Partial<Pick<Note, 'tags' | 'notebookId' | 'title'>>
): Promise<void> {
  const noteRef = doc(db, 'notes', `${userId}_${noteId}`);
  await setDoc(noteRef, { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

// Notebooks
export async function createNotebook(userId: string, name: string): Promise<Notebook> {
  const id = `nb-${Date.now()}`;
  const nbRef = doc(db, 'notebooks', `${userId}_${id}`);
  const notebook: Notebook = {
    id,
    name,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await setDoc(nbRef, {
    ...notebook,
    createdAt: notebook.createdAt.toISOString(),
    updatedAt: notebook.updatedAt.toISOString(),
  });
  return notebook;
}

export async function getUserNotebooks(userId: string): Promise<Notebook[]> {
  const nref = collection(db, 'notebooks');
  const qy = query(nref, where('userId', '==', userId));
  const qs = await getDocs(qy);
  return qs.docs.map(d => {
    const data = d.data();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    } as Notebook;
  });
}

export async function loadNote(userId: string, noteId: string): Promise<Note | null> {
  const noteRef = doc(db, 'notes', `${userId}_${noteId}`);
  const noteSnap = await getDoc(noteRef);
  
  if (noteSnap.exists()) {
    const data = noteSnap.data();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      rootNodes: deserializeNodes(data.rootNodes),
    } as Note;
  }
  
  return null;
}

export async function getUserNotes(userId: string): Promise<Note[]> {
  const notesRef = collection(db, 'notes');
  const q = query(notesRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      rootNodes: deserializeNodes(data.rootNodes),
    } as Note;
  });
}

// Real-time subscriptions are not available in Firestore Lite.
// If you need live updates, switch back to firebase/firestore for onSnapshot
// and consider lazy-loading that code path only when required.

function serializeNodes(nodes: NoteNode[]): any[] {
  return nodes.map(node => ({
    ...node,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    children: serializeNodes(node.children),
  }));
}

function deserializeNodes(nodes: any[]): NoteNode[] {
  return nodes.map(node => ({
    ...node,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    children: deserializeNodes(node.children || []),
  }));
}
