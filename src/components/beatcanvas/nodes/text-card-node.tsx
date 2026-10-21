import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import type { CanvasTextRole } from '@/core/beatcanvas/canvas-types';
import { MAX_TEXT_NODE_CHARS } from '@/core/beatcanvas/text-nodes';
import { useCanvasFrontLayer } from '../beatcanvas-front-layer-context';
import type { BeatCanvasFlowNode } from '../react-flow/beatcanvas-react-flow-types';

export function TextCardNode({
  id,
  data,
  selected,
}: NodeProps<BeatCanvasFlowNode>) {
  const { cards, onTextNodeChange, onTextNodeEditStart } =
    useCanvasFrontLayer();
  const card = cards[id];
  const t = useTranslations('AppShell.studio.textNode');
  const [title, setTitle] = useState(card?.name ?? '');
  useEffect(() => setTitle(card?.name ?? ''), [card?.name]);
  if (card?.kind !== 'text') return null;
  const fieldClass =
    'nodrag nopan nowheel rounded border border-white/10 bg-transparent px-2 py-1 text-[var(--beat-text-1)] outline-none focus:border-[var(--beat-graph)]';
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={240}
        lineClassName="!border-[var(--beat-graph)]"
      />
      <Handle type="target" position={Position.Left} />
      <section
        data-card-id={id}
        data-text-node="true"
        className="flex flex-col overflow-hidden rounded-lg border bg-[var(--beat-surface)] text-[var(--beat-text-1)] shadow-xl"
        style={{
          width: data.props.w,
          height: data.props.h,
          borderColor: selected ? 'var(--beat-graph)' : 'rgba(255,255,255,.12)',
        }}
      >
        <header className="flex items-center gap-2 border-b border-white/10 p-3">
          <FileText size={16} className="shrink-0 text-[var(--beat-graph)]" />
          <input
            aria-label={t('title')}
            maxLength={500}
            value={title}
            className={`${fieldClass} min-w-0 flex-1 text-sm font-medium`}
            onFocus={() => onTextNodeEditStart()}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const name = title.trim() || card.name;
              setTitle(name);
              if (name !== card.name) onTextNodeChange(id, { name });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                event.currentTarget.blur();
            }}
          />
          <select
            aria-label={t('role')}
            className={`${fieldClass} w-24 text-xs`}
            value={card.textRole}
            onFocus={() => onTextNodeEditStart()}
            onChange={(event) =>
              onTextNodeChange(id, {
                textRole: event.target.value as CanvasTextRole,
              })
            }
          >
            {(['note', 'script', 'character', 'storyboard'] as const).map(
              (role) => (
                <option
                  key={role}
                  value={role}
                  className="bg-[var(--beat-surface)]"
                >
                  {t(role)}
                </option>
              )
            )}
          </select>
        </header>
        <textarea
          aria-label={t('content')}
          placeholder={t('placeholder')}
          maxLength={MAX_TEXT_NODE_CHARS}
          value={card.textContent}
          onFocus={() => onTextNodeEditStart()}
          onChange={(event) =>
            onTextNodeChange(id, { textContent: event.target.value })
          }
          className="nodrag nopan nowheel min-h-0 flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-[var(--beat-text-1)] outline-none placeholder:text-[var(--beat-text-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--beat-graph)]"
        />
        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2 text-[11px] text-[var(--beat-text-3)]">
          <span>{t('referenceHint')}</span>
          <span className="shrink-0 tabular-nums">
            {card.textContent.length.toLocaleString()} / 100,000
          </span>
        </footer>
      </section>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
