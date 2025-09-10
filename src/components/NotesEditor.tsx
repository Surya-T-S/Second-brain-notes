'use client';

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { NoteNode, Notebook } from '@/types';
import { useAuth } from './AuthProvider';
import { saveNote, loadNote, updateNoteMeta, getUserNotebooks, createNotebook, deleteNote } from '@/lib/noteService';
// jsPDF is heavy; load it on demand in downloadAsPDF()

interface NotesEditorProps {
  noteId?: string;
  onNoteChange?: () => void;
}

export function NotesEditor({ noteId = 'default', onNoteChange }: NotesEditorProps) {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<NoteNode[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<NoteNode[]>([]);
  const inputRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const hasFocusedInitially = useRef(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeDepth, setActiveDepth] = useState<number | null>(null);
  const [timeString, setTimeString] = useState<string>('');
  const saveTimer = useRef<number | null>(null);
  const latestNodesRef = useRef<NoteNode[]>([]);

  // Export options and editor font selection
  const [showExportOptions, setShowExportOptions] = useState(false);
  type AppFont = 'inter' | 'roboto' | 'open_sans' | 'merriweather' | 'eb_garamond' | 'times_new_roman' | 'roboto_mono';
  const [exportOptions, setExportOptions] = useState<{ bulletStyle: 'formatted' | 'spaces' | 'asterisks' | 'dashes' | 'none'; font: AppFont }>({
    // Default to no visible bullet; indent with spaces
    bulletStyle: 'spaces',
    font: 'inter',
  });
  const [editorFont, setEditorFont] = useState<AppFont>('inter');
  const editorFontMap: Record<AppFont, string> = {
    inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    roboto: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    open_sans: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    merriweather: "'Merriweather', Georgia, 'Times New Roman', Times, serif",
    eb_garamond: "'EB Garamond', Garamond, 'Times New Roman', Times, serif",
    times_new_roman: "'Times New Roman', Times, serif",
    roboto_mono: "'Roboto Mono', 'Courier New', Courier, monospace",
  };

  // Create a new bullet at the current caret position for a node (used by Enter key and toolbar)
  const newBulletAtCaret = (nodeId: string) => {
    const el = inputRefs.current[nodeId];
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer)) return;

    // Build range for tail (caret -> end)
    const tailRange = document.createRange();
    tailRange.setStart(r.startContainer, r.startOffset);
    tailRange.setEnd(el, el.childNodes.length);
    const frag = tailRange.cloneContents();
    const box = document.createElement('div');
    box.appendChild(frag);
    const tailHTML = box.innerHTML;

    // Delete tail in current node
    tailRange.deleteContents();
    const headHTML = el.innerHTML;

    // Update current node and insert a new node after with tailHTML
    const newNode: NoteNode = {
      id: uuidv4(),
      content: tailHTML,
      children: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const withHead = updateNodeContent(nodeId, headHTML);
    const withInsert = insertAfterNode(nodeId, newNode, withHead);
    setNodes(withInsert);
    saveNoteData(withInsert);

    // Focus the new node at start
    requestAnimationFrame(() => {
      const nextEl = inputRefs.current[newNode.id];
      if (nextEl) {
        nextEl.focus();
        setCaret(nextEl, false);
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  // Note metadata: notebooks & tags
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  // Initialize with a single empty node
  useEffect(() => {
    if (user) {
      loadNoteData();
    }
  }, [user, noteId]);

  // Load notebooks list for user
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const list = await getUserNotebooks(user.uid);
        setNotebooks(list);
      } catch (e) {
        console.error('Failed to load notebooks', e);
      }
    };
    run();
  }, [user]);

  // Auto-focus the first visible node on initial load
  useEffect(() => {
    if (!hasFocusedInitially.current && nodes.length > 0) {
      const current = getCurrentNodes();
      const firstId = current[0]?.id;
      if (firstId && inputRefs.current[firstId]) {
        inputRefs.current[firstId].focus();
        hasFocusedInitially.current = true;
      }
    }
  }, [nodes]);

  // Track latest nodes for unmount flush
  useEffect(() => { latestNodesRef.current = nodes; }, [nodes]);

  

  // Keep DOM (contentEditable) in sync for non-active nodes to avoid weird typing
  useEffect(() => {
    const sync = (list: NoteNode[]) => {
      list.forEach(n => {
        const el = inputRefs.current[n.id];
        if (el && el !== document.activeElement) {
          const desired = n.content || '';
          if (el.innerHTML !== desired) {
            el.innerHTML = desired;
          }
        }
        if (n.children && n.children.length) sync(n.children);
      });
    };
    sync(nodes);
  }, [nodes]);

  // Clock updater (glass-style bottom-left)
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
      const t = d.toLocaleTimeString([], opts);
      const dsOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: '2-digit' };
      const ds = d.toLocaleDateString([], dsOpts);
      setTimeString(`${ds} • ${t}`);
    };
    fmt();
    const id = setInterval(fmt, 1000 * 30); // update every 30s
    return () => clearInterval(id);
  }, []);

  const loadNoteData = async () => {
    if (!user) return;
    
    try {
      const note = await loadNote(user.uid, noteId);
      if (note && note.rootNodes.length > 0) {
        setNodes(note.rootNodes);
        setSelectedNotebookId(note.notebookId ?? null);
        setTags(note.tags ?? []);
        // Use saved title or derive from first non-empty node
        if (note.title && note.title.trim()) {
          setNoteTitle(note.title.trim());
        } else {
          const derive = (list: NoteNode[]): string => {
            for (const n of list) {
              const tmp = document.createElement('div');
              tmp.innerHTML = n.content || '';
              const plain = (tmp.textContent || tmp.innerText || '').trim();
              if (plain) return plain;
              const child = derive(n.children || []);
              if (child) return child;
            }
            return '';
          };
          setNoteTitle(derive(note.rootNodes) || '');
        }
      } else {
        // Create initial empty node
        const initialNode: NoteNode = {
          id: uuidv4(),
          content: '',
          children: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setNodes([initialNode]);
        setSelectedNotebookId(null);
        setTags([]);
        setNoteTitle('');
      }
    } catch (error) {
      console.error('Error loading note:', error);
      // Fallback to empty node
      const initialNode: NoteNode = {
        id: uuidv4(),
        content: '',
        children: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setNodes([initialNode]);
      setSelectedNotebookId(null);
      setTags([]);
      setNoteTitle('');
    }
  };

  const saveNoteData = useCallback(async (updatedNodes: NoteNode[]) => {
    if (!user) return;
    
    try {
      await saveNote(user.uid, noteId, {
        id: noteId,
        title: noteTitle?.trim() || 'Untitled',
        userId: user.uid,
        rootNodes: updatedNodes,
        notebookId: selectedNotebookId ?? null,
        tags: tags ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onNoteChange?.();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }, [user, noteId, onNoteChange, selectedNotebookId, tags, noteTitle]);

  const updateNodeContent = (nodeId: string, content: string, nodeList: NoteNode[] = nodes): NoteNode[] => {
    return nodeList.map(node => {
      if (node.id === nodeId) {
        return { ...node, content, updatedAt: new Date() };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeContent(nodeId, content, node.children) };
      }
      return node;
    });
  };

  const addNewNode = (afterNodeId: string, nodeList: NoteNode[] = nodes): NoteNode[] => {
    const newNode: NoteNode = {
      id: uuidv4(),
      content: '',
      children: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const addToList = (nodes: NoteNode[]): NoteNode[] => {
      const index = nodes.findIndex(n => n.id === afterNodeId);
      if (index !== -1) {
        const newNodes = [...nodes];
        newNodes.splice(index + 1, 0, newNode);
        return newNodes;
      }
      
      return nodes.map(node => ({
        ...node,
        children: addToList(node.children)
      }));
    };

    return addToList(nodeList);
  };

  const deleteNode = (nodeId: string, nodeList: NoteNode[] = nodes): NoteNode[] => {
    const deleteFromList = (nodes: NoteNode[]): NoteNode[] => {
      const filtered = nodes.filter(n => n.id !== nodeId);
      return filtered.map(node => ({
        ...node,
        children: deleteFromList(node.children)
      }));
    };

    return deleteFromList(nodeList);
  };

  const indentNode = (nodeId: string, nodeList: NoteNode[] = nodes): NoteNode[] => {
    const findAndIndent = (nodes: NoteNode[], parentNodes: NoteNode[] = []): NoteNode[] => {
      const index = nodes.findIndex(n => n.id === nodeId);
      if (index !== -1 && index > 0) {
        const nodeToIndent = nodes[index];
        const previousNode = nodes[index - 1];
        const newNodes = [...nodes];
        newNodes.splice(index, 1);
        newNodes[index - 1] = {
          ...previousNode,
          children: [...previousNode.children, { ...nodeToIndent, parentId: previousNode.id }]
        };
        return newNodes;
      }
      
      return nodes.map(node => ({
        ...node,
        children: findAndIndent(node.children, [...parentNodes, node])
      }));
    };

    return findAndIndent(nodeList);
  };

  const outdentNode = (nodeId: string, nodeList: NoteNode[] = nodes): NoteNode[] => {
    // If node is at root level, nothing to outdent
    if (nodeList.some(n => n.id === nodeId)) return nodeList;

    type RemoveResult = { updated: NoteNode[]; removed: NoteNode | null; parentId?: string };
    const removeNode = (list: NoteNode[], parentId?: string): RemoveResult => {
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (n.id === nodeId) {
          // Found at this level
          const newList = [...list.slice(0, i), ...list.slice(i + 1)];
          return { updated: newList, removed: n, parentId };
        }
        const childRes = removeNode(n.children, n.id);
        if (childRes.removed) {
          const newChildren = childRes.updated;
          const newNode = { ...n, children: newChildren };
          const newList = [...list.slice(0, i), newNode, ...list.slice(i + 1)];
          return { updated: newList, removed: childRes.removed, parentId: childRes.parentId };
        }
      }
      return { updated: list, removed: null, parentId };
    };

    const { updated, removed, parentId } = removeNode(nodeList);
    if (!removed || !parentId) return nodeList;

    // Insert removed node after its parent, at the parent's level
    const grandParentId = findParentId(updated, parentId) || undefined;
    const nodeToInsert: NoteNode = { ...removed, parentId: grandParentId };
    return insertAfterNode(parentId, nodeToInsert, updated);
  };

  const insertAfterNode = (afterNodeId: string, newNode: NoteNode, nodeList: NoteNode[]): NoteNode[] => {
    const insertInList = (nodes: NoteNode[]): NoteNode[] => {
      const index = nodes.findIndex(n => n.id === afterNodeId);
      if (index !== -1) {
        const newNodes = [...nodes];
        newNodes.splice(index + 1, 0, newNode);
        return newNodes;
      }
      
      return nodes.map(node => ({
        ...node,
        children: insertInList(node.children)
      }));
    };

    return insertInList(nodeList);
  };

  // Create and attach an empty child node to a parent
  const addChildNode = (parentId: string) => {
    const child: NoteNode = {
      id: uuidv4(),
      content: '',
      children: [],
      parentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const attach = (list: NoteNode[]): NoteNode[] => list.map(n => (
      n.id === parentId ? { ...n, children: [...n.children, child] } : { ...n, children: attach(n.children) }
    ));
    const next = attach(nodes);
    setNodes(next);
    saveNoteData(next);
    requestAnimationFrame(() => focusNode(child.id, false));
  };

  // Helpers for keyboard navigation
  const flattenVisibleNodes = (list: NoteNode[]): NoteNode[] => {
    const acc: NoteNode[] = [];
    const dfs = (nodes: NoteNode[]) => {
      nodes.forEach(n => {
        acc.push(n);
        if (n.children && n.children.length && !n.collapsed) dfs(n.children);
      });
    };
    dfs(list);
    return acc;
  };

  // Caret helpers for contentEditable
  const setCaret = (el: HTMLElement, atEnd = true) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(!atEnd); // collapse to start if not atEnd
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const selectionInside = (el: HTMLElement): Range | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
    return r;
  };

  const getCaretOffsets = (el: HTMLElement): { start: number; end: number; total: number } | null => {
    const r = selectionInside(el);
    if (!r) return null;
    const pre = r.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;

    const post = r.cloneRange();
    post.selectNodeContents(el);
    post.setEnd(r.endContainer, r.endOffset);
    const end = post.toString().length;

    const all = document.createRange();
    all.selectNodeContents(el);
    const total = all.toString().length;

    return { start, end, total };
  };

  const isAtStart = (el: HTMLElement): boolean => {
    const off = getCaretOffsets(el);
    if (!off) return false;
    // treat leading whitespace as content; we want exact start
    return off.start === 0 && off.start === off.end; // collapsed at 0
  };

  const isAtEnd = (el: HTMLElement): boolean => {
    const off = getCaretOffsets(el);
    if (!off) return false;
    return off.end === off.total && off.start === off.end; // collapsed at end
  };

  const getPlainText = (el: HTMLElement): string => el.innerText || '';

  // Convert rich HTML content into clean plain text (decodes entities, removes ZWSP & NBSP)
  const htmlToPlain = (html: string): string => {
    const tmp = document.createElement('div');
    // Normalize breaks to spaces before decoding
    const normalized = (html || '')
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\s*div\s*>/gi, ' ')
      .replace(/<\s*\/\s*div\s*>/gi, ' ');
    tmp.innerHTML = normalized;
    const text = tmp.textContent || tmp.innerText || '';
    return text
      .replace(/\u00A0/g, ' ')   // NBSP → space
      .replace(/\u200B/g, '')     // ZWSP → remove
      .replace(/\s+/g, ' ')       // collapse whitespace
      .trim();
  };

  const focusNode = (targetId: string, atEnd = true) => {
    const el = inputRefs.current[targetId];
    if (el) {
      el.focus();
      setCaret(el, atEnd);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Expand selection to the whole word when selection is collapsed
  const offsetToDomPos = (el: HTMLElement, charIndex: number): { node: Node; offset: number } | null => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let idx = 0;
    let node: Node | null = walker.nextNode();
    while (node) {
      const len = (node.textContent || '').length;
      if (charIndex <= idx + len) {
        return { node, offset: Math.max(0, charIndex - idx) };
      }
      idx += len;
      node = walker.nextNode();
    }
    // Fallback to end of the element
    const endWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let last: Node | null = null;
    while (endWalker.nextNode()) last = endWalker.currentNode;
    if (last) return { node: last, offset: (last.textContent || '').length };
    return null;
  };

  const expandSelectionToWord = (el: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer) || !r.collapsed) return;

    const info = getCaretOffsets(el);
    if (!info) return;
    const allRange = document.createRange();
    allRange.selectNodeContents(el);
    const text = allRange.toString();
    const isWordChar = (ch: string) => /\S/.test(ch);
    let start = info.start;
    let end = info.start;
    while (start > 0 && isWordChar(text.charAt(start - 1))) start--;
    while (end < text.length && isWordChar(text.charAt(end))) end++;

    const startPos = offsetToDomPos(el, start);
    const endPos = offsetToDomPos(el, end);
    if (!startPos || !endPos) return;
    const newRange = document.createRange();
    newRange.setStart(startPos.node, startPos.offset);
    newRange.setEnd(endPos.node, endPos.offset);
    sel.removeAllRanges();
    sel.addRange(newRange);
  };

  const applyInlineSize = (el: HTMLElement, scale: 'increase' | 'decrease') => {
    const sel = window.getSelection();
    const wasCollapsed = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;
    if (!sel) return;
    if (wasCollapsed) {
      expandSelectionToWord(el);
    }
    const sel2 = window.getSelection();
    if (!sel2 || sel2.rangeCount === 0) return;
    try {
      const range = sel2.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = scale === 'increase' ? '1.2em' : '0.9em';
      range.surroundContents(span);
      // Collapse to end if we expanded a word
      if (wasCollapsed) {
        const selAfter = window.getSelection();
        if (selAfter && selAfter.rangeCount > 0) {
          const r = selAfter.getRangeAt(0);
          selAfter.collapse(r.endContainer, r.endOffset);
        }
      }
    } catch {}
  };

  const applyExecOnWordOrSelection = (el: HTMLElement, cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough') => {
    const sel = window.getSelection();
    const wasCollapsed = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;
    if (wasCollapsed) {
      expandSelectionToWord(el);
    }
    document.execCommand(cmd);
    if (wasCollapsed) {
      const selAfter = window.getSelection();
      if (selAfter && selAfter.rangeCount > 0) {
        const r = selAfter.getRangeAt(0);
        selAfter.collapse(r.endContainer, r.endOffset);
      }
    }
  };

  const attachChildrenTo = (toId: string, childrenToAdd: NoteNode[], list: NoteNode[]): NoteNode[] => {
    return list.map(n => {
      if (n.id === toId) {
        return { ...n, children: [...n.children, ...childrenToAdd] };
      }
      return { ...n, children: attachChildrenTo(toId, childrenToAdd, n.children) };
    });
  };

  const findParentId = (list: NoteNode[], targetId: string, parentId?: string): string | null => {
    for (const n of list) {
      if (n.id === targetId) return parentId || null;
      const found = findParentId(n.children, targetId, n.id);
      if (found) return found;
    }
    return null;
  };

  const findNodeById = (list: NoteNode[], targetId: string): NoteNode | null => {
    for (const n of list) {
      if (n.id === targetId) return n;
      const found = findNodeById(n.children, targetId);
      if (found) return found;
    }
    return null;
  };

  const isDescendant = (list: NoteNode[], ancestorId: string, targetId: string): boolean => {
    const helper = (nodes: NoteNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === ancestorId) {
          const contains = (arr: NoteNode[]): boolean => {
            for (const c of arr) {
              if (c.id === targetId) return true;
              if (contains(c.children)) return true;
            }
            return false;
          };
          return contains(n.children);
        }
        if (helper(n.children)) return true;
      }
      return false;
    };
    return helper(list);
  };

  // Formatting helpers
  const updateNodeStyle = (nodeId: string, updater: (style: NoteNode['style']) => NoteNode['style']) => {
    const apply = (list: NoteNode[]): NoteNode[] => list.map(n => {
      if (n.id === nodeId) {
        const nextStyle = updater(n.style || {});
        return { ...n, style: nextStyle, updatedAt: new Date() };
      }
      return { ...n, children: apply(n.children) };
    });
    const next = apply(nodes);
    setNodes(next);
    saveNoteData(next);
  };

  // Checklist helpers
  const setNodeIsChecklist = (nodeId: string, isChecklist: boolean) => {
    const apply = (list: NoteNode[]): NoteNode[] => list.map(n => n.id === nodeId
      ? { ...n, isChecklist, updatedAt: new Date() }
      : { ...n, children: apply(n.children) }
    );
    const next = apply(nodes);
    setNodes(next);
    saveNoteData(next);
  };

  const toggleChecklist = (nodeId: string) => {
    const node = findNodeById(nodes, nodeId);
    setNodeIsChecklist(nodeId, !(node?.isChecklist || false));
  };

  const toggleChecked = (nodeId: string) => {
    const apply = (list: NoteNode[]): NoteNode[] => list.map(n => n.id === nodeId
      ? { ...n, checked: !(n.checked || false), updatedAt: new Date() }
      : { ...n, children: apply(n.children) }
    );
    const next = apply(nodes);
    setNodes(next);
    saveNoteData(next);
  };

  const toggleBold = (nodeId: string) => updateNodeStyle(nodeId, s => ({ ...s, bold: !s?.bold }));
  const toggleItalic = (nodeId: string) => updateNodeStyle(nodeId, s => ({ ...s, italic: !s?.italic }));
  const toggleUnderline = (nodeId: string) => updateNodeStyle(nodeId, s => ({ ...s, underline: !s?.underline }));
  const setFontSize = (nodeId: string, size: 'sm' | 'base' | 'lg' | 'xl') => updateNodeStyle(nodeId, s => ({ ...s, size }));
  const incFont = (nodeId: string) => {
    const order: Array<'sm'|'base'|'lg'|'xl'> = ['sm','base','lg','xl'];
    const current = findNodeById(nodes, nodeId)?.style?.size || 'base';
    const idx = Math.min(order.length - 1, order.indexOf(current) + 1);
    setFontSize(nodeId, order[idx]);
  };
  const decFont = (nodeId: string) => {
    const order: Array<'sm'|'base'|'lg'|'xl'> = ['sm','base','lg','xl'];
    const current = findNodeById(nodes, nodeId)?.style?.size || 'base';
    const idx = Math.max(0, order.indexOf(current) - 1);
    setFontSize(nodeId, order[idx]);
  };

  // Collapse/expand helpers (functional updates to avoid stale state)
  const setNodeCollapsed = (nodeId: string, collapsed: boolean) => {
    setNodes(prev => {
      const apply = (list: NoteNode[]): NoteNode[] => list.map(n => n.id === nodeId
        ? { ...n, collapsed, updatedAt: new Date() }
        : { ...n, children: apply(n.children) }
      );
      const next = apply(prev);
      saveNoteData(next);
      return next;
    });
  };
  const toggleCollapse = (nodeId: string) => {
    const willCollapse = !(findNodeById(nodes, nodeId)?.collapsed || false);
    setNodes(prev => {
      const apply = (list: NoteNode[]): NoteNode[] => list.map(n => n.id === nodeId
        ? { ...n, collapsed: willCollapse, updatedAt: new Date() }
        : { ...n, children: apply(n.children) }
      );
      const next = apply(prev);
      saveNoteData(next);
      return next;
    });
    if (willCollapse && activeNodeId && isDescendant(nodes, nodeId, activeNodeId)) {
      requestAnimationFrame(() => focusNode(nodeId, true));
      setActiveNodeId(nodeId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, nodeId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      newBulletAtCaret(nodeId);
      
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (e.shiftKey) return; // allow native selection with Shift
      const div = e.currentTarget as HTMLDivElement;
      const atStart = isAtStart(div);
      const atEnd = isAtEnd(div);
      const flat = flattenVisibleNodes(getCurrentNodes());
      const index = flat.findIndex(n => n.id === nodeId);
      if (e.key === 'ArrowUp' && atStart && index > 0) {
        e.preventDefault();
        focusNode(flat[index - 1].id, true);
      }
      if (e.key === 'ArrowDown' && atEnd && index !== -1 && index < flat.length - 1) {
        e.preventDefault();
        focusNode(flat[index + 1].id, true);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.shiftKey) return; // allow native selection with Shift
      const div = e.currentTarget as HTMLDivElement;
      const atStart = isAtStart(div);
      const atEnd = isAtEnd(div);
      // Alt+Left/Right to structurally outdent/indent
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = outdentNode(nodeId);
        setNodes(next);
        saveNoteData(next);
        requestAnimationFrame(() => focusNode(nodeId, true));
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const next = indentNode(nodeId);
        setNodes(next);
        saveNoteData(next);
        requestAnimationFrame(() => focusNode(nodeId, true));
        return;
      }

      const flat = flattenVisibleNodes(getCurrentNodes());
      const index = flat.findIndex(n => n.id === nodeId);
      if (e.key === 'ArrowLeft' && atStart) {
        // Move to previous bullet end
        if (index > 0) {
          e.preventDefault();
          focusNode(flat[index - 1].id, true);
        }
      }
      if (e.key === 'ArrowRight' && atEnd) {
        // Only navigate: do NOT auto-expand collapsed sections
        const node = findNodeById(nodes, nodeId);
        const firstChild = node?.children?.[0];
        if (firstChild) {
          e.preventDefault();
          if (!node?.collapsed) {
            focusNode(firstChild.id, false);
          } else {
            // If collapsed, move to next visible bullet instead
            if (index !== -1 && index < flat.length - 1) {
              focusNode(flat[index + 1].id, false);
            }
          }
          return;
        }
        // Otherwise move to next bullet start
        if (index !== -1 && index < flat.length - 1) {
          e.preventDefault();
          focusNode(flat[index + 1].id, false);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const updatedNodes = outdentNode(nodeId);
        setNodes(updatedNodes);
        saveNoteData(updatedNodes);
        requestAnimationFrame(() => focusNode(nodeId, true));
      } else {
        const updatedNodes = indentNode(nodeId);
        setNodes(updatedNodes);
        saveNoteData(updatedNodes);
        requestAnimationFrame(() => focusNode(nodeId, true));
      }
    } else if (e.key === 'Backspace') {
      const div = e.currentTarget as HTMLDivElement;
      const flat = flattenVisibleNodes(getCurrentNodes());
      const idx = flat.findIndex(n => n.id === nodeId);

      // Merge with previous bullet when caret is at start
      if (isAtStart(div) && idx > 0) {
        e.preventDefault();
        const prevId = flat[idx - 1].id;
        const prevEl = inputRefs.current[prevId];
        const currEl = inputRefs.current[nodeId];
        const prevHtml = (prevEl?.innerHTML) ?? (findNodeById(nodes, prevId)?.content || '');
        const currHtml = (currEl?.innerHTML) ?? (findNodeById(nodes, nodeId)?.content || '');
        const toPlain = (html: string) => html.replace(/<[^>]+>/g, '');
        const prevPlain = toPlain(prevHtml);
        const currPlain = toPlain(currHtml);
        const needsSpace = /\S$/.test(prevPlain) && /^\S/.test(currPlain);
        const mergedHtml = needsSpace ? (prevHtml + ' ' + currHtml) : (prevHtml + currHtml);

        const currNodeObj = findNodeById(nodes, nodeId);
        const withMerged = updateNodeContent(prevId, mergedHtml);
        const withChildren = attachChildrenTo(prevId, currNodeObj?.children || [], withMerged);
        const afterDelete = deleteNode(nodeId, withChildren);
        setNodes(afterDelete);
        saveNoteData(afterDelete);
        requestAnimationFrame(() => {
          focusNode(prevId, true);
        });
        return;
      }

      // If empty bullet, delete it
      const getTotalNodeCount = (list: NoteNode[]): number => list.reduce((acc, n) => acc + 1 + getTotalNodeCount(n.children), 0);
      if (getPlainText(div).trim() === '' && getTotalNodeCount(nodes) > 1) {
        e.preventDefault();
        const flatBefore = flattenVisibleNodes(getCurrentNodes());
        const currentIndex = flatBefore.findIndex(n => n.id === nodeId);
        const updatedNodes = deleteNode(nodeId);
        setNodes(updatedNodes);
        saveNoteData(updatedNodes);
        requestAnimationFrame(() => {
          const flatAfter = flattenVisibleNodes(updatedNodes);
          let targetIdx = Math.max(0, currentIndex - 1);
          if (targetIdx >= flatAfter.length) targetIdx = flatAfter.length - 1;
          const targetId = flatAfter[targetIdx]?.id;
          if (targetId) focusNode(targetId, true);
        });
      }
    }
  };

  const scheduleSave = (data: NoteNode[]) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      saveNoteData(data);
      saveTimer.current = null;
    }, 400) as unknown as number;
  };

  const handleContentChange = (nodeId: string, content: string) => {
    const updatedNodes = updateNodeContent(nodeId, content);
    setNodes(updatedNodes);
    scheduleSave(updatedNodes);
  };

  const handleNodeClick = (node: NoteNode) => {
    if (node.children.length > 0) {
      setFocusedNodeId(node.id);
      setBreadcrumbs([...breadcrumbs, node]);
    }
  };

  const navigateBack = () => {
    if (breadcrumbs.length > 0) {
      const newBreadcrumbs = [...breadcrumbs];
      newBreadcrumbs.pop();
      setBreadcrumbs(newBreadcrumbs);
      
      if (newBreadcrumbs.length === 0) {
        setFocusedNodeId(null);
      } else {
        setFocusedNodeId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
      }
    }
  };

  const renderNode = (node: NoteNode, depth: number = 0) => {
    return (
      <div key={node.id} className={`node-container ${depth > 0 ? 'indented-node' : ''}`}>
        <div
          className="flex items-start space-x-3 mb-3 group"
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            // Ignore clicks inside the contentEditable editor
            if (target.closest('[data-collapse-toggle="true"]')) {
              // Let the collapse button handle this without focusing editor
              return;
            }
            if (!target.closest('[data-editor="true"]')) {
              e.preventDefault();
              focusNode(node.id, true);
            }
          }}
        >
          <div className="bullet-container">
            {node.isChecklist ? (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(ev) => { ev.stopPropagation(); toggleChecked(node.id); }}
                aria-pressed={!!node.checked}
                className={`w-4 h-4 mt-1 flex items-center justify-center rounded-sm border ${node.checked ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/70 dark:bg-gray-900/40 border-gray-300 dark:border-gray-600 text-transparent'} transition-colors`}
                title={node.checked ? 'Mark as not done' : 'Mark as done'}
              >
                ✓
              </button>
            ) : (
              <div className="bullet-dot"></div>
            )}
          </div>
          <div className="flex-1">
            <div
              ref={(el) => { if (el) { inputRefs.current[node.id] = el; if (el.innerHTML !== (node.content || '')) { el.innerHTML = node.content || ''; } } }}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              data-editor="true"
              onInput={(e) => {
                const html = (e.currentTarget as HTMLDivElement).innerHTML;
                handleContentChange(node.id, html);
              }}
              onBlur={() => { if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; saveNoteData(latestNodesRef.current); } }}
              onKeyDown={(e) => {
                // Formatting shortcuts applied to selection
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyExecOnWordOrSelection(el, 'bold'); handleContentChange(node.id, el.innerHTML); } return; }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyExecOnWordOrSelection(el, 'italic'); handleContentChange(node.id, el.innerHTML); } return; }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyExecOnWordOrSelection(el, 'underline'); handleContentChange(node.id, el.innerHTML); } return; }
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyExecOnWordOrSelection(el, 'strikeThrough'); handleContentChange(node.id, el.innerHTML); } return; }
                if (e.altKey && e.shiftKey && e.key === '5') { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyExecOnWordOrSelection(el, 'strikeThrough'); handleContentChange(node.id, el.innerHTML); } return; }
                if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyInlineSize(el, 'increase'); handleContentChange(node.id, el.innerHTML); } return; }
                if ((e.ctrlKey || e.metaKey) && (e.key === '-')) { e.preventDefault(); const el = inputRefs.current[node.id]; if (el) { applyInlineSize(el, 'decrease'); handleContentChange(node.id, el.innerHTML); } return; }
                handleKeyDown(e as KeyboardEvent<HTMLDivElement>, node.id);
              }}
              // Disable focus-mode on content click to avoid unintended shrinking
              onFocus={() => { setActiveNodeId(node.id); setActiveDepth(depth); }}
              className={`note-input w-full bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-100 leading-relaxed ${node.checked ? 'line-through opacity-60' : ''}`}
              style={{ minHeight: '1.75rem', lineHeight: '1.6', overflow: 'hidden' }}
            />
          </div>
          {node.children.length > 0 && (
            <button
              type="button"
              data-collapse-toggle="true"
              className="ml-2 px-1.5 py-0.5 text-base leading-none rounded border text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm hover:bg-white/40"
              title={node.collapsed ? 'Expand' : 'Collapse'}
              onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
              onClick={(ev) => { ev.stopPropagation(); toggleCollapse(node.id); }}
            >
              {node.collapsed ? '+' : '–'}
            </button>
          )}
        </div>
        {!node.collapsed && (
          <div className={`children-container ${activeNodeId && node.children.some(c => c.id === activeNodeId) ? 'indent-active' : ''}`}>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getCurrentNodes = (): NoteNode[] => {
    if (!focusedNodeId) return nodes;
    
    const findNode = (nodes: NoteNode[]): NoteNode | null => {
      for (const node of nodes) {
        if (node.id === focusedNodeId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };

    const focusedNode = findNode(nodes);
    return focusedNode ? focusedNode.children : nodes;
  };

  const downloadAsPDF = async (opts?: { bulletStyle: 'formatted' | 'spaces' | 'asterisks' | 'dashes' | 'none'; font: AppFont }) => {
    try {
      const options = opts || exportOptions;
      const { default: JSPDF } = await import('jspdf');
      const pdf = new JSPDF('p', 'mm', 'a4');
      const resolvePdfFont = (f: AppFont): 'helvetica' | 'times' | 'courier' => {
        switch (f) {
          case 'inter':
          case 'roboto':
          case 'open_sans':
            return 'helvetica';
          case 'merriweather':
          case 'eb_garamond':
          case 'times_new_roman':
            return 'times';
          case 'roboto_mono':
            return 'courier';
          default:
            return 'helvetica';
        }
      };
      const pdfFamily = resolvePdfFont(options.font);
      const leftMargin = 10;
      const usableWidth = 190; // A4 width minus margins
      const pageTop = 20;
      const pageBottom = 280;
      let yPosition = pageTop;
      const baseFontSize = 12;

      type TextRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; scale?: number };

      const normalizeSpaces = (s: string) => s.replace(/\u00A0/g, ' ');

      const parseFontSizeScale = (fontSize: string | null | undefined, parentScale: number): number => {
        if (!fontSize) return parentScale;
        const fs = fontSize.trim();
        if (fs.endsWith('em')) {
          const v = parseFloat(fs);
          if (!isNaN(v)) return parentScale * v;
        }
        if (fs.endsWith('px')) {
          const px = parseFloat(fs);
          if (!isNaN(px)) {
            const pt = px * 0.75; // approx px->pt
            return pt / baseFontSize;
          }
        }
        const n = parseFloat(fs);
        if (!isNaN(n)) return n / baseFontSize;
        return parentScale;
      };

      const extractRunsFromHTML = (html: string): TextRun[] => {
        const container = document.createElement('div');
        container.innerHTML = html || '';
        const runs: TextRun[] = [];

        const walk = (node: Node, ctx: { bold: boolean; italic: boolean; underline: boolean; strike: boolean; scale: number }) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = normalizeSpaces(node.textContent || '');
            if (text) runs.push({ text, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, strike: ctx.strike, scale: ctx.scale });
            return;
          }
          if (!(node instanceof HTMLElement)) {
            node.childNodes.forEach(child => walk(child, ctx));
            return;
          }

          let nextCtx = { ...ctx };
          const tag = node.tagName.toLowerCase();
          if (tag === 'b' || tag === 'strong') nextCtx.bold = true;
          if (tag === 'i' || tag === 'em') nextCtx.italic = true;
          if (tag === 'u') nextCtx.underline = true;
          if (tag === 's' || tag === 'strike' || tag === 'del') nextCtx.strike = true;
          if (tag === 'br') {
            runs.push({ text: ' ', bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, strike: ctx.strike, scale: ctx.scale });
            return;
          }

          const style = (node as HTMLElement).style;
          if (style) {
            if (style.fontWeight && (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600)) nextCtx.bold = true;
            if (style.fontStyle && style.fontStyle === 'italic') nextCtx.italic = true;
            if (style.textDecoration && style.textDecoration.includes('underline')) nextCtx.underline = true;
            if (style.textDecoration && style.textDecoration.includes('line-through')) nextCtx.strike = true;
            if (style.fontSize && style.fontSize.trim()) nextCtx.scale = parseFontSizeScale(style.fontSize, nextCtx.scale);
          }

          node.childNodes.forEach(child => walk(child, nextCtx));
        };

        walk(container, { bold: false, italic: false, underline: false, strike: false, scale: 1 });
        return runs;
      };

      const setFontForRun = (run: TextRun) => {
        let style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
        if (run.bold && run.italic) style = 'bolditalic';
        else if (run.bold) style = 'bold';
        else if (run.italic) style = 'italic';
        pdf.setFont(pdfFamily, style);
        const size = Math.max(8, Math.round(baseFontSize * (run.scale || 1)));
        pdf.setFontSize(size);
        return size;
      };

      const drawUnderline = (x: number, y: number, text: string) => {
        const width = pdf.getTextWidth(text);
        const prev = pdf.getLineWidth();
        pdf.setLineWidth(0.4);
        pdf.line(x, y + 0.8, x + width, y + 0.8);
        pdf.setLineWidth(prev);
      };

      const drawStrikethrough = (x: number, y: number, text: string) => {
        const width = pdf.getTextWidth(text);
        const prev = pdf.getLineWidth();
        pdf.setLineWidth(0.4);
        // Strikethrough roughly through the middle of text line
        pdf.line(x, y - 1.8, x + width, y - 1.8);
        pdf.setLineWidth(prev);
      };

      const ensurePageSpace = (needed: number) => {
        if (yPosition + needed > pageBottom) {
          pdf.addPage();
          yPosition = pageTop;
        }
      };

      const addNotesToPDF = (nodeList: NoteNode[], indent: number = 0) => {
        nodeList.forEach(node => {
          const runs = extractRunsFromHTML(node.content || '');
          const hasContent = runs.some(r => (r.text || '').trim().length > 0);
          const isChecklist = !!node.isChecklist;
          const isChecked = !!node.checked;
          if (!hasContent) {
            // Empty line for structure; only draw bullet if formatted style
            ensurePageSpace(6);
            if (options.bulletStyle === 'formatted') {
              const bulletX = leftMargin + (indent * 6);
              if (isChecklist) {
                // Draw a square checkbox
                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(0.25);
                pdf.rect(bulletX - 1.5, yPosition - 3.5, 3, 3);
                if (isChecked) {
                  pdf.setLineWidth(0.4);
                  pdf.line(bulletX - 1.1, yPosition - 1.2, bulletX - 0.3, yPosition + 0.6);
                  pdf.line(bulletX - 0.3, yPosition + 0.6, bulletX + 1.4, yPosition - 1.6);
                }
              } else {
                pdf.setFillColor(0, 0, 0);
                pdf.circle(bulletX, yPosition - 2, 0.9, 'F');
              }
            }
            yPosition += 6;
          } else {
            const unitIndent = 6; // mm per indent level
            const bulletX = options.bulletStyle === 'none' ? leftMargin : (leftMargin + (indent * unitIndent));
            let textXStart = options.bulletStyle === 'none' ? leftMargin : (bulletX + (options.bulletStyle === 'formatted' ? 4 : 6));
            const maxWidth = (options.bulletStyle === 'none' ? usableWidth : (usableWidth - (indent * 10))) - 4;
            let x = textXStart;
            let currentLineHeight = 6;

            // Prepare first line prefix/bullet
            ensurePageSpace(currentLineHeight);
            if (options.bulletStyle === 'formatted') {
              if (isChecklist) {
                // Draw checkbox
                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(0.25);
                pdf.rect(bulletX - 1.5, yPosition - 3.5, 3, 3);
                if (isChecked) {
                  pdf.setLineWidth(0.4);
                  pdf.line(bulletX - 1.1, yPosition - 1.2, bulletX - 0.3, yPosition + 0.6);
                  pdf.line(bulletX - 0.3, yPosition + 0.6, bulletX + 1.4, yPosition - 1.6);
                }
              } else {
                pdf.setFillColor(0, 0, 0);
                pdf.circle(bulletX, yPosition - 2, 0.9, 'F');
              }
            } else if (options.bulletStyle === 'asterisks' || options.bulletStyle === 'dashes') {
              const prefix = isChecklist ? (isChecked ? '[x] ' : '[ ] ') : (options.bulletStyle === 'asterisks' ? '* ' : '- ');
              pdf.setFont(pdfFamily, 'normal');
              pdf.setFontSize(baseFontSize);
              pdf.text(prefix, x, yPosition);
              x += pdf.getTextWidth(prefix);
            }

            const tokens: Array<TextRun & { token: string }> = [];
            runs.forEach(run => {
              const parts = (run.text || '').split(/(\s+)/);
              parts.forEach(p => { if (p.length > 0) tokens.push({ ...run, token: p }); });
            });

            tokens.forEach(tk => {
              const isSpace = /^\s+$/.test(tk.token);
              if (x === textXStart && isSpace) return; // skip leading spaces

              const size = setFontForRun(tk);
              const width = pdf.getTextWidth(tk.token);
              currentLineHeight = Math.max(currentLineHeight, 5 + (size - baseFontSize) * 0.35);

              // Wrap if exceeding max width
              if (x + width - textXStart > maxWidth) {
                yPosition += currentLineHeight;
                ensurePageSpace(currentLineHeight);
                x = textXStart;
                currentLineHeight = Math.max(6, 5 + (size - baseFontSize) * 0.35);
                if (isSpace) return; // skip spaces at new line start
              }

              pdf.text(tk.token, x, yPosition);
              if (tk.underline) drawUnderline(x, yPosition, tk.token);
              if (tk.strike) drawStrikethrough(x, yPosition, tk.token);
              x += width;
            });

            // Spacing after each bullet
            yPosition += currentLineHeight + 1;
          }

          if (node.children.length > 0) {
            addNotesToPDF(node.children, indent + 1);
          }
        });
      };

      // Title
      const deriveTitle = (list: NoteNode[]): string => {
        for (const n of list) {
          const tmp = document.createElement('div');
          tmp.innerHTML = n.content || '';
          const plain = (tmp.textContent || tmp.innerText || '').trim();
          if (plain) return plain;
          const child = deriveTitle(n.children || []);
          if (child) return child;
        }
        return '';
      };
      const titlePlain = (noteTitle?.trim() || deriveTitle(getCurrentNodes()) || 'Notes');
      pdf.setFont(pdfFamily, 'bold');
      pdf.setFontSize(16);
      pdf.text(titlePlain, leftMargin, yPosition);
      yPosition += 12;

      pdf.setFont(pdfFamily, 'normal');
      pdf.setFontSize(baseFontSize);
      addNotesToPDF(getCurrentNodes());

      const slugify = (s: string) => (
        s
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\- _]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .toLowerCase()
          .slice(0, 60)
      );
      const titleSlug = slugify(titlePlain) || 'notes';
      const fileName = `${titleSlug}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-none">
      {/* Breadcrumbs */}
      {false && breadcrumbs.length > 0 && (
        <div className="mb-6 flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <button
            onClick={() => {
              setFocusedNodeId(null);
              setBreadcrumbs([]);
            }}
            className="hover:text-blue-500 transition-colors"
          >
            Home
          </button>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center space-x-2">
              <span>/</span>
              <button
                onClick={() => {
                  const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                  setBreadcrumbs(newBreadcrumbs);
                  setFocusedNodeId(crumb.id);
                }}
                className="hover:text-blue-500 transition-colors truncate max-w-32"
              >
                {htmlToPlain(crumb.content || '') || 'Untitled'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="rounded-xl border bg-white/50 dark:bg-gray-800/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-md p-6">
        {/* Formatting Toolbar */}
        {/* Meta bar: Title, Notebooks & Tags */}
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2">
          {/* Title input */}
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-white/10 px-2.5 py-1.5">
            <span className="text-xs text-gray-600 dark:text-gray-300">Title</span>
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              onBlur={async () => { if (user) await updateNoteMeta(user.uid, noteId, { title: noteTitle?.trim() || 'Untitled' }); }}
              onKeyDown={async (e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
              placeholder="Untitled"
              className="px-2 py-1 rounded-md text-sm bg-white/40 dark:bg-gray-900/20 border border-white/30 dark:border-white/10 text-gray-800 dark:text-gray-100 outline-none"
              style={{ width: '14rem' }}
            />
          </div>
          {/* Notebook selector */}
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-white/10 px-2.5 py-1.5">
            <span className="text-xs text-gray-600 dark:text-gray-300">Notebook</span>
            <select
              value={selectedNotebookId ?? ''}
              onChange={async (e) => {
                const value = e.target.value || null;
                setSelectedNotebookId(value);
                if (user) {
                  await updateNoteMeta(user.uid, noteId, { notebookId: value });
                }
              }}
              className="px-2 py-1 rounded-md text-sm bg-white/40 dark:bg-gray-900/20 border border-white/30 dark:border-white/10 text-gray-800 dark:text-gray-100"
            >
              <option value="">All Notes</option>
              {notebooks.map(nb => (
                <option key={nb.id} value={nb.id}>{nb.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded-md bg-blue-500/85 hover:bg-blue-500/95 text-white border border-white/20"
              onClick={async () => {
                if (!user) return;
                const name = prompt('New notebook name');
                if (!name) return;
                const created = await createNotebook(user.uid, name);
                const list = await getUserNotebooks(user.uid);
                setNotebooks(list);
                setSelectedNotebookId(created.id);
                await updateNoteMeta(user.uid, noteId, { notebookId: created.id });
              }}
            >
              New
            </button>
          </div>

          {/* Tags editor */}
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-white/10 px-2.5 py-1.5">
            <span className="text-xs text-gray-600 dark:text-gray-300">Tags</span>
            <div className="flex flex-wrap items-center gap-1">
              {tags.map((t, idx) => (
                <span key={`${t}-${idx}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-white/50 dark:bg-gray-900/30 border border-white/30 dark:border-white/10 text-gray-800 dark:text-gray-100">
                  #{t}
                  <button className="ml-1 text-gray-500 hover:text-gray-700" onClick={async () => {
                    const next = tags.filter((x) => x !== t);
                    setTags(next);
                    if (user) await updateNoteMeta(user.uid, noteId, { tags: next });
                  }}>×</button>
                </span>
              ))}
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newTag.trim().replace(/^[#]+/, '');
                    if (!val) return;
                    if (tags.includes(val)) { setNewTag(''); return; }
                    const next = [...tags, val];
                    setTags(next);
                    setNewTag('');
                    if (user) await updateNoteMeta(user.uid, noteId, { tags: next });
                  }
                }}
                placeholder="Add tag & Enter"
                className="px-2 py-0.5 rounded-md text-sm bg-white/60 dark:bg-gray-900/30 border border-white/30 dark:border-white/10 text-gray-800 dark:text-gray-100 outline-none"
                style={{ width: '10rem' }}
              />
            </div>
          </div>
        </div>

        <div className="sticky top-12 z-10 mb-3 inline-flex self-start items-center gap-2 rounded-xl bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm px-2.5 py-1.5 overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!activeNodeId) return;
              const el = inputRefs.current[activeNodeId];
              if (!el) return;
              el.focus();
              document.execCommand('bold');
              handleContentChange(activeNodeId, el.innerHTML);
            }}
            disabled={!activeNodeId}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'} ${activeNodeId && findNodeById(nodes, activeNodeId)?.style?.bold ? 'ring-1 ring-white/50 dark:ring-white/30' : ''}`}
            title="Bold (Ctrl/Cmd + B)"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!activeNodeId) return;
              const el = inputRefs.current[activeNodeId];
              if (!el) return;
              el.focus();
              document.execCommand('italic');
              handleContentChange(activeNodeId, el.innerHTML);
            }}
            disabled={!activeNodeId}
            className={`px-2.5 py-1.5 rounded-lg text-sm italic border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'} ${activeNodeId && findNodeById(nodes, activeNodeId)?.style?.italic ? 'ring-1 ring-white/50 dark:ring-white/30' : ''}`}
            title="Italic (Ctrl/Cmd + I)"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!activeNodeId) return;
              const el = inputRefs.current[activeNodeId];
              if (!el) return;
              el.focus();
              document.execCommand('underline');
              handleContentChange(activeNodeId, el.innerHTML);
            }}
            disabled={!activeNodeId}
            className={`px-2.5 py-1.5 rounded-lg text-sm underline underline-offset-2 border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'} ${activeNodeId && findNodeById(nodes, activeNodeId)?.style?.underline ? 'ring-1 ring-white/50 dark:ring-white/30' : ''}`}
            title="Underline (Ctrl/Cmd + U)"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!activeNodeId) return;
              const el = inputRefs.current[activeNodeId];
              if (!el) return;
              el.focus();
              document.execCommand('strikeThrough');
              handleContentChange(activeNodeId, el.innerHTML);
            }}
            disabled={!activeNodeId}
            className={`px-2.5 py-1.5 rounded-lg text-sm border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'}`}
            title="Strikethrough (Ctrl/Cmd + Shift + X or Alt + Shift + 5)"
          >
            <span className="line-through">S</span>
          </button>
          <div className="ml-1 flex items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!activeNodeId) return;
                const el = inputRefs.current[activeNodeId];
                if (!el) return;
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  try {
                    const range = sel.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontSize = '0.9em';
                    range.surroundContents(span);
                    handleContentChange(activeNodeId, el.innerHTML);
                  } catch {}
                }
              }}
              disabled={!activeNodeId}
              className={`px-2.5 py-1.5 rounded-lg text-sm border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'}`}
              title="Smaller (Ctrl/Cmd + -)"
            >
              A-
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!activeNodeId) return;
                const el = inputRefs.current[activeNodeId];
                if (!el) return;
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  try {
                    const range = sel.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontSize = '1.2em';
                    range.surroundContents(span);
                    handleContentChange(activeNodeId, el.innerHTML);
                  } catch {}
                }
              }}
              disabled={!activeNodeId}
              className={`px-2.5 py-1.5 rounded-lg text-sm border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 ${activeNodeId ? 'hover:bg-white/45 dark:hover:bg-white/20' : 'opacity-50 cursor-not-allowed'}`}
              title="Larger (Ctrl/Cmd + +)"
            >
              A+
            </button>
            {/* Editor font selector (7 professional fonts) */}
            <div className="ml-2 flex items-center gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Font</span>
              <select
                value={editorFont}
                onChange={(e) => setEditorFont(e.target.value as AppFont)}
                className="px-2 py-1 rounded-lg text-sm border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/45 dark:hover:bg-white/20 focus:outline-none"
                title="Editor font (export will map to a matching PDF font)"
              >
                <option value="inter">Inter</option>
                <option value="roboto">Roboto</option>
                <option value="open_sans">Open Sans</option>
                <option value="merriweather">Merriweather</option>
                <option value="eb_garamond">EB Garamond</option>
                <option value="times_new_roman">Times New Roman</option>
                <option value="roboto_mono">Roboto Mono</option>
              </select>
            </div>
          </div>
        </div>
        <div className="space-y-1" style={{ fontFamily: editorFontMap[editorFont] || undefined }}>
          {getCurrentNodes().map(node => renderNode(node))}
        </div>
      </div>

      {/* Shortcuts outside the editor card */}
      <div className="mt-3 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-xl bg-white/40 dark:bg-gray-900/25 backdrop-blur-md border border-white/20 dark:border-white/10 px-3 py-1.5 text-lg md:text-base text-gray-700 dark:text-gray-200 shadow-sm">
          <button
            type="button"
            className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/40"
            title="New bullet (Enter)"
            onClick={() => { if (activeNodeId) newBulletAtCaret(activeNodeId); }}
          >↵</button>
          <button
            type="button"
            className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/40"
            title="Indent (Tab)"
            onClick={() => { if (!activeNodeId) return; const updated = indentNode(activeNodeId); setNodes(updated); saveNoteData(updated); requestAnimationFrame(() => focusNode(activeNodeId, true)); }}
          >⇥</button>
          <button
            type="button"
            className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/40"
            title="Outdent (Shift+Tab)"
            onClick={() => { if (!activeNodeId) return; const updated = outdentNode(activeNodeId); setNodes(updated); saveNoteData(updated); requestAnimationFrame(() => focusNode(activeNodeId, true)); }}
          >⇧⇥</button>
          <button
            type="button"
            className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/40"
            title="Focus child"
            onClick={() => {
              if (!activeNodeId) return;
              const n = findNodeById(nodes, activeNodeId);
              if (n && n.children && n.children.length > 0) {
                focusNode(n.children[0].id, false);
              } else {
                addChildNode(activeNodeId);
              }
            }}
          >•⟶</button>
        </div>
      </div>

      {/* Download button */
      }
      {/* Export options modal */}
      {showExportOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 border border-white/20 dark:border-white/10 shadow-xl p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Export options</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indentation style</div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-800 dark:text-gray-100">
                  {(['formatted','spaces','asterisks','dashes','none'] as const).map(style => (
                    <label key={style} className="flex items-center gap-2 rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-gray-900/20 px-3 py-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bullet-style"
                        value={style}
                        checked={exportOptions.bulletStyle === style}
                        onChange={() => setExportOptions(prev => ({ ...prev, bulletStyle: style }))}
                      />
                      <span className="capitalize">{style}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font</div>
                <select
                  value={exportOptions.font}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, font: e.target.value as AppFont }))}
                  className="w-full px-3 py-2 rounded-lg border border-white/30 dark:border-white/10 bg-white/40 dark:bg-gray-900/20 text-gray-800 dark:text-gray-100"
                >
                  <option value="inter">Inter</option>
                  <option value="roboto">Roboto</option>
                  <option value="open_sans">Open Sans</option>
                  <option value="merriweather">Merriweather</option>
                  <option value="eb_garamond">EB Garamond</option>
                  <option value="times_new_roman">Times New Roman</option>
                  <option value="roboto_mono">Roboto Mono</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Export will map to a matching PDF core font automatically.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowExportOptions(false)} className="px-3 py-1.5 rounded-md border border-white/30 dark:border-white/10 bg-white/40 dark:bg-gray-900/20 text-gray-800 dark:text-gray-100">Cancel</button>
              <button
                onClick={() => { downloadAsPDF(exportOptions); setShowExportOptions(false); }}
                className="px-3 py-1.5 rounded-md bg-blue-500/85 hover:bg-blue-500/95 text-white border border-white/20 shadow-sm"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={async () => {
            if (!user) return;
            const ok = confirm('Delete this note? This action cannot be undone.');
            if (!ok) return;
            try {
              await deleteNote(user.uid, noteId);
              // Reset editor state to a fresh note
              const initialNode: NoteNode = {
                id: uuidv4(),
                content: '',
                children: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              setNodes([initialNode]);
              setSelectedNotebookId(null);
              setTags([]);
              setNoteTitle('');
              onNoteChange?.();
            } catch (err) {
              console.error('Failed to delete note', err);
              alert('Failed to delete note.');
            }
          }}
          className="px-3 py-2 text-red-500/90 hover:text-red-600 text-sm rounded-xl transition-all duration-200 flex items-center gap-2 flex-shrink-0 bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 border border-white/30 ring-1 ring-inset ring-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl active:scale-[0.98]"
          title="Delete note"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
          </svg>
          <span>Delete</span>
        </button>
        <button
          onClick={() => { setExportOptions(prev => ({ ...prev, font: editorFont })); setShowExportOptions(true); }}
          className="px-4 py-2 text-white text-sm rounded-md transition-colors flex items-center space-x-2 flex-shrink-0 bg-blue-500/85 hover:bg-blue-500/95 border border-white/20 shadow-sm backdrop-blur-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Download PDF</span>
        </button>
      </div>
      {/* Glass-style clock bottom-left */}
      <div className="fixed left-4 bottom-4 z-20 rounded-xl bg-white/25 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 select-none">
        {timeString}
      </div>
    </div>
  );
}
