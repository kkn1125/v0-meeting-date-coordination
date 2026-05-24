"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { RangeSpanWithKeys } from "@/lib/calendar-ranges";
import { requestInboxRefresh } from "@/lib/inbox-events";
import { parseMemoContent } from "@/lib/memo-content";
import type { Memo, ParticipantWithDateRanges, RoomLabel } from "@/lib/types";
import { LabelSelectField } from "./label-select-field";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MentionInput } from "./mention-input";

interface PeriodMemoPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  roomId: string;
  range: RangeSpanWithKeys;
  labels: RoomLabel[];
  memos: Memo[];
  participants: ParticipantWithDateRanges[];
  currentParticipantId?: string;
  currentParticipantIsHost?: boolean;
  highlightMemoId?: string;
  onMemosChange: (memos: Memo[]) => void;
}

function MemoContentDisplay({ content }: { content: string }) {
  const parts = parseMemoContent(content);
  return (
    <span className="whitespace-pre-wrap break-words text-sm">
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <Badge
            key={i}
            style={{
              backgroundColor: "#C7E0FF", // pastel blue
              color: "#205081", // darker blue for text
            }}
            className="mx-0.5 px-[5px] py-0.5 text-xs border-none"
          >
            @{part.name}
          </Badge>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
}

export function PeriodMemoPanel({
  open,
  onClose,
  anchorRect,
  roomId,
  range,
  labels,
  memos,
  participants,
  currentParticipantId,
  currentParticipantIsHost = false,
  highlightMemoId,
  onMemosChange,
}: PeriodMemoPanelProps) {
  const [content, setContent] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labelId, setLabelId] = useState<string | null>(range.labelId);
  const [isLabelSaving, setIsLabelSaving] = useState(false);

  const lockedLabel = useMemo(() => {
    if (!range.labelId) return null;
    return labels.find((l) => l.id === range.labelId) ?? null;
  }, [labels, range.labelId]);

  const labelLocked = range.labelIsValid === false;

  useEffect(() => {
    if (open) {
      setLabelId(range.labelId);
    }
  }, [open, range.labelId]);

  const handleMentionChange = useCallback(
    (nextContent: string, ids: string[]) => {
      setContent(nextContent);
      setMentionIds(ids);
    },
    [],
  );

  const rangeMemos = useMemo(
    () => memos.filter((m) => m.date_range_id === range.rangeId),
    [memos, range.rangeId],
  );

  const activeParticipants = useMemo(
    () =>
      participants
        .filter((p) => !p.deleted_at)
        .map((p) => ({ id: p.id, name: p.name })),
    [participants],
  );

  useEffect(() => {
    if (!open) {
      setContent("");
      setMentionIds([]);
      setEditingMemoId(null);
    }
  }, [open]);

  if (!open || !anchorRect) return null;

  const placeAbove = anchorRect.top > window.innerHeight / 2;
  const top = placeAbove ? anchorRect.top - 8 : anchorRect.bottom + 8;
  const left = Math.min(anchorRect.left, window.innerWidth - 360);

  const resetForm = () => {
    setContent("");
    setMentionIds([]);
    setEditingMemoId(null);
  };

  const handleSubmit = async () => {
    if (!currentParticipantId || !content.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingMemoId) {
        const res = await apiFetch(`/api/rooms/${roomId}/memos/${editingMemoId}`, {
          method: "PATCH",
          body: JSON.stringify({
            content,
            mentionParticipantIds: mentionIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onMemosChange(
          memos.map((m) => (m.id === editingMemoId ? data.memo : m)),
        );
      } else {
        const res = await apiFetch(`/api/rooms/${roomId}/memos`, {
          method: "POST",
          body: JSON.stringify({
            dateRangeId: range.rangeId,
            content,
            mentionParticipantIds: mentionIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onMemosChange([...memos, data.memo]);
      }
      resetForm();
      requestInboxRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (memoId: string) => {
    if (!currentParticipantId) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/rooms/${roomId}/memos/${memoId}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      onMemosChange(memos.filter((m) => m.id !== memoId));
      if (editingMemoId === memoId) resetForm();
      requestInboxRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (memo: Memo) => {
    setEditingMemoId(memo.id);
    setContent(memo.content);
    setMentionIds((memo.mentions ?? []).map((m) => m.mentioned_participant_id));
  };

  const handleLabelChange = async (nextLabelId: string | null) => {
    if (!currentParticipantId || labelLocked) return;
    setIsLabelSaving(true);
    try {
      const res = await apiFetch(`/api/date-ranges/${range.rangeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          roomId,
          labelId: nextLabelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLabelId(nextLabelId);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLabelSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 flex max-h-[min(420px,70vh)] w-[min(360px,calc(100vw-2rem))] flex-col rounded-md border bg-popover shadow-lg"
        style={{
          left,
          top,
          transform: placeAbove ? "translateY(-100%)" : undefined,
        }}
      >
        <div className="flex items-start justify-between border-b px-3 py-2">
          <div>
            <p className="text-sm font-medium">
              {range.participantName} 기간 메모
            </p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(range.startDate), "M/d", { locale: ko })} ~{" "}
              {format(parseISO(range.endDate), "M/d", { locale: ko })}
              {range.isAvailable ? " · 가능" : " · 불가"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {currentParticipantId ? (
            <LabelSelectField
              labels={labels}
              value={labelId}
              onChange={(v) => void handleLabelChange(v)}
              disabled={isLabelSaving || labelLocked}
              lockedLabel={labelLocked ? lockedLabel : null}
            />
          ) : null}

          {rangeMemos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 메모가 없습니다.
            </p>
          ) : (
            rangeMemos.map((memo) => {
              const canEdit =
                memo.author_participant_id === currentParticipantId;
              const canDelete = canEdit || currentParticipantIsHost;

              return (
                <div
                  key={memo.id}
                  id={`memo-${memo.id}`}
                  className={`rounded-md border p-2 ${
                    highlightMemoId === memo.id
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {memo.author_name}
                    </span>
                    <div className="flex gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => startEdit(memo)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDelete(memo.id)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <MemoContentDisplay content={memo.content} />
                </div>
              );
            })
          )}
        </div>

        {currentParticipantId ? (
          <div className="space-y-2 border-t p-3">
            <MentionInput
              participants={activeParticipants}
              value={content}
              onChange={handleMentionChange}
              disabled={isSubmitting}
            />
            <div className="flex justify-end gap-2">
              {editingMemoId && (
                <Button variant="outline" size="sm" onClick={resetForm}>
                  취소
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
              >
                {editingMemoId ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t p-3 text-xs text-muted-foreground">
            메모를 작성하려면 로그인이 필요합니다.
          </p>
        )}
      </div>
    </>
  );
}
