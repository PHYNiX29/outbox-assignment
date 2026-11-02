import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignLeft,
  Bold,
  ChevronsUpDown,
  Indent,
  Italic,
  List,
  ListOrdered,
  Outdent,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  onChange: (html: string, isEmpty: boolean) => void;
  placeholder?: string;
}

function ToolButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-[#5f5f5f] hover:bg-surface',
        active && 'bg-brand-soft text-brand',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-2 h-7 w-px bg-line" />;

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  const cycleHeading = () => {
    if (editor.isActive('heading', { level: 1 })) chain().setParagraph().run();
    else if (editor.isActive('heading', { level: 2 })) chain().toggleHeading({ level: 1 }).run();
    else if (editor.isActive('heading', { level: 3 })) chain().toggleHeading({ level: 2 }).run();
    else chain().toggleHeading({ level: 3 }).run();
  };

  return (
    <div className="flex flex-wrap items-center rounded-full bg-white px-4 py-1.5">
      <ToolButton label="Undo" onClick={() => chain().undo().run()}>
        <Undo2 size={20} />
      </ToolButton>
      <ToolButton label="Redo" onClick={() => chain().redo().run()}>
        <Redo2 size={20} />
      </ToolButton>
      <Divider />
      <ToolButton label="Text size" onClick={cycleHeading} active={editor.isActive('heading')}>
        <Type size={20} />
      </ToolButton>
      <Divider />
      <ToolButton label="Bold" onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')}>
        <Bold size={20} />
      </ToolButton>
      <ToolButton label="Italic" onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')}>
        <Italic size={20} />
      </ToolButton>
      <ToolButton label="Underline" onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')}>
        <UnderlineIcon size={20} />
      </ToolButton>
      <Divider />
      <ToolButton
        label="Align center"
        onClick={() => chain().setTextAlign(editor.isActive({ textAlign: 'center' }) ? 'left' : 'center').run()}
        active={editor.isActive({ textAlign: 'center' })}
      >
        <AlignCenter size={20} />
      </ToolButton>
      <ToolButton label="Line break" onClick={() => chain().setHardBreak().run()}>
        <ChevronsUpDown size={20} />
      </ToolButton>
      <Divider />
      <ToolButton label="Numbered list" onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
        <ListOrdered size={20} />
      </ToolButton>
      <ToolButton label="Bullet list" onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')}>
        <List size={20} />
      </ToolButton>
      <ToolButton label="Indent" onClick={() => chain().sinkListItem('listItem').run()}>
        <Indent size={20} />
      </ToolButton>
      <ToolButton label="Outdent" onClick={() => chain().liftListItem('listItem').run()}>
        <Outdent size={20} />
      </ToolButton>
      <ToolButton label="Quote" onClick={() => chain().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
        <Quote size={20} />
      </ToolButton>
      <ToolButton label="Align left" onClick={() => chain().setTextAlign('left').run()}>
        <AlignLeft size={20} />
      </ToolButton>
      <Divider />
      <ToolButton label="Strikethrough" onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')}>
        <Strikethrough size={20} />
      </ToolButton>
    </div>
  );
}

export function RichTextEditor({ onChange, placeholder = 'Type Your Reply...' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: 'tiptap prose-email min-h-[28px] px-1 text-[17px] leading-relaxed' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.isEmpty),
  });

  if (!editor) return null;
  return (
    <div className="min-h-[520px] rounded-xl bg-[#fafafa] px-5 pb-6 pt-4">
      <div className="mb-4 cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
      <div>
        <Toolbar editor={editor} />
      </div>
    </div>
  );
}
