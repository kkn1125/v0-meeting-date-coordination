"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  extractMentionParticipantIds,
  parseMemoContent,
  serializeMention,
} from "@/lib/memo-content";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface MentionParticipant {
  id: string;
  name: string;
}

interface MentionInputProps {
  participants: MentionParticipant[];
  value: string;
  onChange: (content: string, mentionIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MENTION_CHIP_CLASS =
  "mention-chip mx-0.5 inline cursor-default select-all rounded-md bg-secondary px-1 py-0 text-xs leading-5 text-secondary-foreground";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToEditorHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function contentToEditorHtml(content: string): string {
  const parts = parseMemoContent(content);
  if (parts.length === 0) return "";

  return parts
    .map((part) => {
      if (part.type === "mention") {
        const name = escapeHtml(part.name);
        const id = escapeHtml(part.participantId);
        return `<span class="${MENTION_CHIP_CLASS}" contenteditable="false" data-mention-id="${id}" data-mention-name="${name}">@${name}</span>`;
      }
      return textToEditorHtml(part.value);
    })
    .join("");
}

function isMentionElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).dataset.mentionId !== undefined
  );
}

function isBlockElement(element: HTMLElement): boolean {
  const tag = element.tagName;
  return tag === "DIV" || tag === "P";
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  if (element.dataset.mentionId !== undefined) {
    const id = element.dataset.mentionId;
    const name = element.dataset.mentionName;
    return id && name ? serializeMention(name, id) : "";
  }
  if (element instanceof HTMLBRElement) {
    return "\n";
  }
  if (isBlockElement(element)) {
    return serializeChildNodes(element);
  }
  return serializeChildNodes(element);
}

/** contenteditable Enter가 만드는 div/p 경계를 줄바꿈(\n)으로 직렬화 */
function serializeChildNodes(parent: HTMLElement): string {
  let result = "";
  for (const child of parent.childNodes) {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      isBlockElement(child as HTMLElement) &&
      result.length > 0 &&
      !result.endsWith("\n")
    ) {
      result += "\n";
    }
    result += serializeNode(child);
  }
  return result;
}

function domToContent(root: HTMLElement): string {
  return serializeChildNodes(root);
}

function getTextBeforeCursor(editor: HTMLElement, range: Range): string {
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString();
}

function getPreviousTextPosition(
  editor: HTMLElement,
  container: Node,
  offset: number,
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container as Text;
    if (offset > 0) {
      return { node: text, offset: offset - 1 };
    }
    container = text;
  }

  let current: Node | null =
    container.nodeType === Node.ELEMENT_NODE && offset > 0
      ? (container as Element).childNodes[offset - 1] ?? container
      : container;

  while (current && current !== editor) {
    if (current.previousSibling) {
      current = current.previousSibling;
      while (current.lastChild) {
        current = current.lastChild;
      }
      if (current.nodeType === Node.TEXT_NODE) {
        const text = current as Text;
        return { node: text, offset: (text.textContent?.length ?? 1) - 1 };
      }
      if (isMentionElement(current)) {
        return null;
      }
      continue;
    }
    current = current.parentNode;
  }
  return null;
}

function getMentionMatchAtCursor(
  editor: HTMLElement,
): { query: string; replaceRange: Range } | null {
  const sel = window.getSelection();
  if (!sel?.isCollapsed || sel.rangeCount === 0) return null;

  const endRange = sel.getRangeAt(0);
  if (!editor.contains(endRange.startContainer)) return null;

  const before = getTextBeforeCursor(editor, endRange);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;

  const replaceRange = endRange.cloneRange();
  let remaining = match[0].length;
  let container: Node = endRange.startContainer;
  let offset = endRange.startOffset;

  while (remaining > 0) {
    if (container.nodeType === Node.TEXT_NODE) {
      const deleteCount = Math.min(offset, remaining);
      offset -= deleteCount;
      remaining -= deleteCount;
      if (remaining === 0) {
        replaceRange.setStart(container, offset);
        replaceRange.setEnd(endRange.endContainer, endRange.endOffset);
        return { query: match[1], replaceRange };
      }
    }

    const prev = getPreviousTextPosition(editor, container, offset);
    if (!prev) return null;
    container = prev.node;
    offset = prev.offset + 1;
  }

  return null;
}

function createMentionChip(participant: MentionParticipant): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = MENTION_CHIP_CLASS;
  span.contentEditable = "false";
  span.dataset.mentionId = participant.id;
  span.dataset.mentionName = participant.name;
  span.textContent = `@${participant.name}`;
  return span;
}

function insertMentionAtRange(
  replaceRange: Range,
  participant: MentionParticipant,
) {
  replaceRange.deleteContents();
  const chip = createMentionChip(participant);
  replaceRange.insertNode(chip);
  const spacer = document.createTextNode("\u00a0");
  chip.after(spacer);

  const sel = window.getSelection();
  if (!sel) return;
  const after = document.createRange();
  after.setStart(spacer, 1);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
}

function removeMentionBeforeCursor(editor: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel?.isCollapsed || sel.rangeCount === 0) return false;

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return false;

  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  if (node.nodeType === Node.TEXT_NODE && offset > 0) return false;

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.previousSibling;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    node = (node as Element).childNodes[offset - 1] ?? null;
  }

  if (node && isMentionElement(node)) {
    node.remove();
    return true;
  }

  return false;
}

function isEditorEmpty(editor: HTMLElement): boolean {
  const content = domToContent(editor).replace(/\u00a0/g, " ").trim();
  return content.length === 0 && !editor.querySelector("[data-mention-id]");
}

export function MentionInput({
  participants,
  value,
  onChange,
  placeholder = "메모를 입력하세요. @로 멘션할 수 있습니다.",
  disabled = false,
  className,
}: MentionInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const isComposingRef = useRef(false);
  const mentionRangeRef = useRef<Range | null>(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEmpty, setIsEmpty] = useState(() => value.trim().length === 0);

  onChangeRef.current = onChange;

  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const content = domToContent(editor);
    const mentionIds = extractMentionParticipantIds(content);
    setIsEmpty(isEditorEmpty(editor));

    if (content === lastEmittedRef.current) return;
    lastEmittedRef.current = content;
    onChangeRef.current(content, mentionIds);
  }, []);

  const syncEditorFromValue = useCallback((content: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = contentToEditorHtml(content);
    setIsEmpty(isEditorEmpty(editor));
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const current = domToContent(editor);
    if (value === lastEmittedRef.current && current === value) return;

    lastEmittedRef.current = value;
    syncEditorFromValue(value);
  }, [value, syncEditorFromValue]);

  const filteredParticipants = useMemo(() => {
    const q = query.toLowerCase();
    return participants.filter((p) => p.name.toLowerCase().includes(q));
  }, [participants, query]);

  const updateMentionSuggestions = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isComposingRef.current) return;

    const match = getMentionMatchAtCursor(editor);
    if (match) {
      mentionRangeRef.current = match.replaceRange;
      setQuery(match.query);
      setSelectedIndex(0);
      setShowSuggestions(true);
    } else {
      mentionRangeRef.current = null;
      setShowSuggestions(false);
      setQuery("");
    }
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const editor = editorRef.current;
      const sel = document.getSelection();
      if (!editor || !sel?.anchorNode || !editor.contains(sel.anchorNode)) {
        return;
      }
      updateMentionSuggestions();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [updateMentionSuggestions]);

  const insertMention = (participant: MentionParticipant) => {
    const editor = editorRef.current;
    if (!editor) return;

    const range =
      mentionRangeRef.current ?? getMentionMatchAtCursor(editor)?.replaceRange;
    if (!range) return;

    insertMentionAtRange(range, participant);
    mentionRangeRef.current = null;
    setShowSuggestions(false);
    setQuery("");
    syncFromEditor();
    editor.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      showSuggestions &&
      filteredParticipants.length > 0 &&
      (e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Tab" ||
        e.key === "Enter")
    ) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredParticipants.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) =>
            (i - 1 + filteredParticipants.length) % filteredParticipants.length,
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredParticipants[selectedIndex]);
        return;
      }
    }

    if (e.key === "Escape" && showSuggestions) {
      e.preventDefault();
      setShowSuggestions(false);
      return;
    }

    if (e.key === "Backspace") {
      const editor = editorRef.current;
      if (editor && removeMentionBeforeCursor(editor)) {
        e.preventDefault();
        syncFromEditor();
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      {isEmpty && !disabled && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 top-2 text-sm leading-5 text-muted-foreground"
        >
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => {
          if (!isComposingRef.current) {
            syncFromEditor();
            updateMentionSuggestions();
          }
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          syncFromEditor();
          updateMentionSuggestions();
        }}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className={cn(
          "mention-editor min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "whitespace-pre-wrap break-words",
          disabled && "pointer-events-none opacity-50",
        )}
      />

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>참여자를 찾을 수 없습니다.</CommandEmpty>
              <CommandGroup heading="참여자">
                {filteredParticipants.map((p, i) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      queueMicrotask(() => insertMention(p));
                    }}
                    className={cn(i === selectedIndex && "bg-accent")}
                  >
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
