"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toISOStringValue } from "@/lib/dates";
import type { RoomLabel } from "@/lib/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Pencil, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";

interface RoomLabelsPanelProps {
  roomId: string;
  labels: RoomLabel[];
  currentParticipantId: string;
  currentParticipantIsHost: boolean;
  onLabelsChange: (labels: RoomLabel[]) => void;
}

export function RoomLabelsPanel({
  roomId,
  labels,
  currentParticipantId,
  currentParticipantIsHost,
  onLabelsChange,
}: RoomLabelsPanelProps) {
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: currentParticipantId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLabelsChange([...labels, data.label]);
      setNewName("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleValid = async (label: RoomLabel, isValid: boolean) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/labels/${label.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: currentParticipantId,
          isValid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLabelsChange(
        labels.map((l) => (l.id === label.id ? { ...l, ...data.label } : l)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveName = async (labelId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/labels/${labelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: currentParticipantId,
          name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLabelsChange(
        labels.map((l) => (l.id === labelId ? { ...l, ...data.label } : l)),
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (labelId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/labels/${labelId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: currentParticipantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLabelsChange(data.labels ?? labels.filter((l) => l.id !== labelId));
    } catch (err) {
      console.error(err);
    }
  };

  const canDelete = (label: RoomLabel) =>
    currentParticipantIsHost ||
    label.created_by_participant_id === currentParticipantId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          라벨
        </CardTitle>
        <CardDescription>
          기간 분류용 라벨을 등록하고 관리합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="라벨 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            disabled={isSubmitting}
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || isSubmitting}
            size="sm"
          >
            등록
          </Button>
        </div>

        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 라벨이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {labels.map((label) => {
              const isEditing = editingId === label.id;

              return (
                <li
                  key={label.id}
                  className="rounded-lg border p-3 space-y-2 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <div className="flex flex-1 gap-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => void handleSaveName(label.id)}
                          disabled={isSubmitting}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-sm truncate ${
                            !label.is_valid ? "text-muted-foreground" : ""
                          }`}
                        >
                          {label.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(() => {
                            const iso = toISOStringValue(label.created_at);
                            if (!iso) return "—";
                            return format(new Date(iso), "yyyy.M.d", {
                              locale: ko,
                            });
                          })()}{" "}
                          · {label.created_by_name ?? "—"} · 연관 기간{" "}
                          {label.date_range_count ?? 0}개
                        </p>
                      </div>
                    )}
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingId(label.id);
                            setEditingName(label.name);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete(label) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => void handleDelete(label.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">유효</span>
                    <Switch
                      checked={label.is_valid}
                      onCheckedChange={(checked) =>
                        void handleToggleValid(label, checked)
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
