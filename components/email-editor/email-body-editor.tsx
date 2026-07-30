"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Eraser,
  Heading2,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  WrapText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TokenNode,
  pillsToTokens,
  tokensToPills,
  unsupportedMarkup,
} from "./token-node";
import { TokenChips } from "./token-chips";
import { FieldPicker, useBraceTrigger } from "./field-picker";
import { insertAtCursor, wrapSelection } from "./insert-at-cursor";

// Utilities applied to the editable area. Kept here rather than in globals.css
// so the token pill and the email-ish body styling stay next to the editor that
// produces them.
const CONTENT_CLASSES = cn(
  "min-h-64 max-h-[28rem] overflow-y-auto rounded-b-md bg-background px-3 py-2 text-sm",
  "focus:outline-none",
  // Paragraph and list rendering, roughly matching how the sent email reads.
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-0.5 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_hr]:my-3 [&_hr]:border-t",
  // The {token} pills.
  "[&_.email-token]:rounded [&_.email-token]:bg-primary/10 [&_.email-token]:px-1 [&_.email-token]:py-0.5",
  "[&_.email-token]:font-mono [&_.email-token]:text-xs [&_.email-token]:text-primary",
  "[&_.email-token]:ring-1 [&_.email-token]:ring-primary/20",
  "[&_.ProseMirror-selectednode.email-token]:ring-2 [&_.ProseMirror-selectednode.email-token]:ring-primary",
);

type Mode = "rich" | "html";

/**
 * The body editor: a rich-text surface for people writing email copy, and an
 * HTML view for anyone who needs the markup.
 *
 * `forceHtml` is set for fragment templates (the shared layout, a list row) —
 * a bare `<li>` or a layout `<table>` has no valid rich-text representation, so
 * those are authored as source only.
 */
export function EmailBodyEditor({
  value,
  onChange,
  tokens,
  forceHtml = false,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  tokens: readonly string[];
  forceHtml?: boolean;
  disabled?: boolean;
}) {
  // Markup the rich-text model would drop. Measured against the copy as first
  // loaded, so it doesn't flicker while typing.
  const [initialValue] = useState(value);
  const lossy = useMemo(
    () => (forceHtml ? [] : unsupportedMarkup(initialValue)),
    [forceHtml, initialValue],
  );

  const [mode, setMode] = useState<Mode>(
    forceHtml || lossy.length > 0 ? "html" : "rich",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The editor is needed by the `{` handler that has to be installed while the
  // editor is being created, so the handler reaches it through a ref.
  const editorRef = useRef<Editor | null>(null);
  const brace = useBraceTrigger(() =>
    editorRef.current?.chain().focus().insertContent("{").run(),
  );

  // What we last handed to onChange. Lets us tell our own edits apart from the
  // parent replacing the value wholesale (a revert, or restoring a version),
  // which is the only case where the editor should be reloaded from props.
  const emitted = useRef(value);

  const editor = useEditor({
    // Tiptap must not render during SSR — the server has no DOM to build the
    // editor view against.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // Emails are short messages, not documents: no code blocks, and h2 is
        // the only heading level that makes sense inside one.
        codeBlock: false,
        heading: { levels: [2] },
        link: { openOnClick: false, autolink: false },
      }),
      TokenNode,
    ],
    content: tokensToPills(value),
    editorProps: {
      attributes: { class: CONTENT_CLASSES },
      // Typing `{` is how anyone would start a token by hand, so it opens the
      // field picker instead. Dismissing the picker types the literal `{`, so
      // the keystroke is never swallowed.
      handleKeyDown: (_view, event) => {
        if (event.key !== "{") return false;
        event.preventDefault();
        brace.trigger();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = pillsToTokens(editor.getHTML());
      emitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  // Reload only on an external change — otherwise every keystroke would reset
  // the document and drop the cursor to the top.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(tokensToPills(value));
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const insertToken = useCallback(
    (token: string) => {
      if (mode === "html") {
        const el = textareaRef.current;
        if (!el) return;
        const next = insertAtCursor(el, `{${token}}`);
        emitted.current = next;
        onChange(next);
        return;
      }
      editor
        ?.chain()
        .focus()
        .insertContent({ type: "token", attrs: { name: token } })
        .run();
    },
    [editor, mode, onChange],
  );

  // Wrap the selected copy in {#token}…{/token}, so that part of the email only
  // appears when the field has a value. Source mode only: the markers are
  // structural and would be parsed as text by the rich-text model.
  const insertConditional = useCallback(
    (token: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const next = wrapSelection(
        el,
        `{#${token}}`,
        `{/${token}}`,
        `{${token}}`,
      );
      emitted.current = next;
      onChange(next);
    },
    [onChange],
  );

  const handleSourceChange = (html: string) => {
    emitted.current = html;
    onChange(html);
  };

  const switchMode = (next: Mode) => {
    // Leaving source mode: push the edited HTML into the editor so the two
    // views agree before the rich surface takes over.
    if (next === "rich" && editor) {
      editor.commands.setContent(tokensToPills(value));
      emitted.current = value;
    }
    setMode(next);
  };

  return (
    <div className="space-y-2">
      {lossy.length > 0 && !forceHtml && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This template uses {lossy.join(", ")}, which the rich-text editor
            cannot represent. Edit it as HTML to keep that markup — switching to
            rich text will simplify it.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
          {mode === "rich" && editor && (
            <>
              <ToolbarButton
                label="Bold"
                icon={Bold}
                active={editor.isActive("bold")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <ToolbarButton
                label="Italic"
                icon={Italic}
                active={editor.isActive("italic")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <ToolbarButton
                label="Underline"
                icon={UnderlineIcon}
                active={editor.isActive("underline")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              />
              <ToolbarButton
                label="Strikethrough"
                icon={Strikethrough}
                active={editor.isActive("strike")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton
                label="Heading"
                icon={Heading2}
                active={editor.isActive("heading", { level: 2 })}
                disabled={disabled}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
              />
              <ToolbarButton
                label="Bullet list"
                icon={List}
                active={editor.isActive("bulletList")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                label="Numbered list"
                icon={ListOrdered}
                active={editor.isActive("orderedList")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <ToolbarButton
                label="Quote"
                icon={Quote}
                active={editor.isActive("blockquote")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <LinkButton editor={editor} disabled={disabled} />
              <ToolbarButton
                label="Remove link"
                icon={Link2Off}
                disabled={disabled || !editor.isActive("link")}
                onClick={() => editor.chain().focus().unsetLink().run()}
              />
              <ToolbarButton
                label="Line break"
                icon={WrapText}
                disabled={disabled}
                onClick={() => editor.chain().focus().setHardBreak().run()}
              />
              <ToolbarButton
                label="Divider"
                icon={Minus}
                disabled={disabled}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton
                label="Undo"
                icon={Undo2}
                disabled={disabled || !editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}
              />
              <ToolbarButton
                label="Redo"
                icon={Redo2}
                disabled={disabled || !editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}
              />
              <ToolbarButton
                label="Clear formatting"
                icon={Eraser}
                disabled={disabled}
                onClick={() =>
                  editor.chain().focus().unsetAllMarks().clearNodes().run()
                }
              />
              <Separator orientation="vertical" className="mx-1 h-5" />
            </>
          )}

          <FieldPicker
            tokens={tokens}
            disabled={disabled}
            open={brace.open}
            onOpenChange={brace.onOpenChange}
            onSelect={brace.wrapSelect(insertToken)}
          />

          {mode === "html" && (
            <FieldPicker
              tokens={tokens}
              disabled={disabled}
              variant="conditional"
              onSelect={insertConditional}
            />
          )}

          {mode === "html" && (
            <span className="hidden px-1.5 text-xs text-muted-foreground sm:inline">
              {forceHtml
                ? "A snippet used inside other emails — edited as HTML."
                : "Editing raw HTML."}
            </span>
          )}

          {!forceHtml && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 px-2 text-xs"
              onClick={() => switchMode(mode === "rich" ? "html" : "rich")}
            >
              <Code2 className="h-3.5 w-3.5" />
              {mode === "rich" ? "HTML" : "Rich text"}
            </Button>
          )}
        </div>

        {mode === "rich" ? (
          <EditorContent editor={editor} />
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(e) => handleSourceChange(e.target.value)}
            spellCheck={false}
            className="min-h-64 rounded-t-none border-0 font-mono text-xs focus-visible:ring-0"
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Click to insert — these are replaced with real values when the email is
          sent.
          {mode === "rich" && (
            <> Or type {"{"} in the editor to search all fields.</>
          )}
        </p>
        <TokenChips tokens={tokens} onInsert={insertToken} disabled={disabled} />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className="h-7 w-7 p-0"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

function LinkButton({
  editor,
  disabled,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  const openPopover = (next: boolean) => {
    // Seed the field with the link already under the cursor, so opening this on
    // an existing link edits it rather than starting from blank.
    if (next) setHref((editor.getAttributes("link").href as string) ?? "");
    setOpen(next);
  };

  const apply = () => {
    const url = href.trim();
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openPopover}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="sm"
          title="Link"
          aria-label="Link"
          disabled={disabled}
          className="h-7 w-7 p-0"
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="start">
        <p className="text-sm font-medium">Link address</p>
        <Input
          value={href}
          placeholder="https://example.com"
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          A {"{token}"} works here too, e.g. {"{summaryUrl}"}.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
