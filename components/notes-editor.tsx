import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Pencil, Save, X } from "lucide-react";
import api from "@/lib/axios";
import { authClient } from "@/lib/auth-client";

interface NotesEditorProps {
  employeeId: number;
  notes: string | null;
  onNotesUpdate?: (notes: string) => void; // Optional callback for parent to handle updates
}

export default function NotesEditor({
  employeeId,
  notes,
  onNotesUpdate,
}: NotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";

  const handleEdit = () => {
    setEditedNotes(notes || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedNotes(notes || "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await api.patch(`api/employees/${employeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: editedNotes }),
      });

      if (!response) {
        throw new Error("Failed to update notes");
      }

      // Call parent callback if provided
      onNotesUpdate?.(editedNotes);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating notes:", error);
      // You might want to show a toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Employee Notes</CardTitle>
        {isAdmin ? (
          !isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-8 w-8 p-0"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                className="h-8 w-8 p-0"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          )
        ) : null}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            placeholder="Add notes about this employee..."
            className="min-h-[100px] resize-none"
            disabled={isSaving}
          />
        ) : (
          <div className="min-h-[100px] p-3 text-sm bg-muted/50 rounded-md">
            {notes ? (
              <p className="whitespace-pre-wrap">{notes}</p>
            ) : (
              <p className="text-muted-foreground italic">
                No notes added yet.{" "}
                {isAdmin && "Click the edit button to add some."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
