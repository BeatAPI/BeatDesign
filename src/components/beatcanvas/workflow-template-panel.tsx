import { useState } from 'react';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import {
  templateDefinitionDigest,
  type WorkflowTemplateDefinition,
} from '@/core/workflows/workflow-template';

export type WorkflowTemplateSummary = {
  id: string;
  name: string;
  revision: number;
};
export type WorkflowTemplatePanelProps = {
  templates: WorkflowTemplateSummary[];
  assets: Array<{
    id: string;
    name?: string;
    filename?: string | null;
    type: string;
  }>;
  selectedCount: number;
  onPreviewCapture: () => Promise<WorkflowTemplateDefinition>;
  onCapture: (name: string, definitionDigest: string) => Promise<unknown>;
  onLoadDefinition: (templateId: string) => Promise<WorkflowTemplateDefinition>;
  onInstantiate: (input: {
    templateId: string;
    templateRevision: number;
    bindings: Record<string, string>;
    placement: { x: number; y: number };
  }) => Promise<unknown>;
  onRename: (
    templateId: string,
    revision: number,
    name: string
  ) => Promise<unknown>;
  onRemove: (templateId: string, revision: number) => Promise<unknown>;
};
const control =
  'min-h-11 rounded-lg border border-white/15 bg-[var(--beat-surface,#17181b)] px-3 text-sm text-[var(--beat-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-40';
const button = `${control} hover:bg-white/10`;

/** Local template controls delegate all authoritative writes to their shared command owner. */
export function WorkflowTemplatePanel(props: WorkflowTemplatePanelProps) {
  const t = useTranslations('Organization');
  const [captureName, setCaptureName] = useState('');
  const [capturePreview, setCapturePreview] =
    useState<WorkflowTemplateDefinition | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplateSummary | null>(
    null
  );
  const [definition, setDefinition] =
    useState<WorkflowTemplateDefinition | null>(null);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [rename, setRename] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placementX, setPlacementX] = useState('0');
  const [placementY, setPlacementY] = useState('0');
  const validPlacement =
    placementX.trim() !== '' &&
    placementY.trim() !== '' &&
    Number.isFinite(Number(placementX)) &&
    Number.isFinite(Number(placementY));
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }
  function renderDefinition(value: WorkflowTemplateDefinition) {
    return (
      <div
        className="space-y-2 text-sm"
        data-testid="template-definition-preview"
      >
        <ol className="list-inside list-decimal space-y-1">
          {value.steps.map((step) => (
            <li key={step.localId}>
              {step.name}
              {step.kind === 'generation'
                ? ` · ${[step.configuration.modelId, step.configuration.aspectRatio, step.configuration.outputQuality, step.configuration.duration, step.configuration.language].filter(Boolean).join(' · ')}`
                : ''}
              {(step.configuration.textContent ||
                step.configuration.prompt) && (
                <p className="whitespace-pre-wrap rounded-lg bg-black/15 p-2 text-xs text-[var(--beat-text-3)]">
                  {step.configuration.textContent || step.configuration.prompt}
                </p>
              )}
            </li>
          ))}
        </ol>
        {value.edges.length > 0 && (
          <ul className="space-y-1 text-xs text-[var(--beat-text-3)]">
            {value.edges.map((edge) => (
              <li key={`${edge.toStepId}:${edge.order}`}>
                {
                  value.steps.find((step) => step.localId === edge.fromStepId)
                    ?.name
                }{' '}
                →{' '}
                {
                  value.steps.find((step) => step.localId === edge.toStepId)
                    ?.name
                }
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--beat-text-3)]">
          {t('templateStructure', {
            steps: value.steps.length,
            references: value.slots.length,
            connections: value.edges.length,
          })}
        </p>
      </div>
    );
  }
  return (
    <details
      className="rounded-xl border border-white/10 bg-[var(--beat-panel,#111214)] text-[var(--beat-text-1)]"
      data-testid="workflow-template-panel"
    >
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        {t('templates')}
      </summary>
      <div className="space-y-4 border-t border-white/10 p-4">
        <p className="text-xs text-[var(--beat-text-3)]">
          {t('templateLocalOnly')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <section aria-label={t('templateSave')} className="space-y-3">
          <label className="block space-y-1 text-xs">
            {t('templateName')}
            <input
              className={`${control} block w-full`}
              value={captureName}
              maxLength={200}
              onChange={(event) => setCaptureName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={button}
            disabled={busy || props.selectedCount === 0}
            onClick={() =>
              void run(async () =>
                setCapturePreview(await props.onPreviewCapture())
              )
            }
          >
            {t('templatePreviewSelection')}
          </button>
          {capturePreview && (
            <div className="space-y-3 rounded-lg border border-white/10 p-3">
              {renderDefinition(capturePreview)}
              {capturePreview.slots.map((slot) => (
                <p className="text-xs" key={slot.id}>
                  {slot.label} · {slot.mediaType}
                </p>
              ))}
              <button
                type="button"
                className={button}
                disabled={busy || !captureName.trim()}
                onClick={() =>
                  void run(async () => {
                    await props.onCapture(
                      captureName.trim(),
                      templateDefinitionDigest(capturePreview)
                    );
                    setCapturePreview(null);
                    setCaptureName('');
                  })
                }
              >
                {t('templateSave')}
              </button>
            </div>
          )}
        </section>
        <section
          aria-label={t('templateLibrary')}
          className="space-y-3 border-t border-white/10 pt-4"
        >
          <label className="block space-y-1 text-xs">
            {t('templateLibrary')}
            <select
              className={`${control} block w-full`}
              value={template?.id ?? ''}
              disabled={busy}
              onChange={(event) => {
                const selected = props.templates.find(
                  (item) => item.id === event.target.value
                );
                setDefinition(null);
                setTemplate(null);
                setBindings({});
                setConfirmRemove(false);
                if (selected)
                  void run(async () => {
                    const loaded = await props.onLoadDefinition(selected.id);
                    setTemplate(selected);
                    setRename(selected.name);
                    setDefinition(loaded);
                  });
              }}
            >
              <option value="">{t('templateChoose')}</option>
              {props.templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {definition && template && (
            <>
              {renderDefinition(definition)}
              {definition.slots.map((slot) => (
                <label key={slot.id} className="block space-y-1 text-xs">
                  {slot.label} · {slot.mediaType}
                  {slot.required ? ` · ${t('templateRequired')}` : ''}
                  <select
                    className={`${control} block w-full`}
                    value={bindings[slot.id] ?? ''}
                    disabled={busy}
                    onChange={(event) =>
                      setBindings((previous) => ({
                        ...previous,
                        [slot.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">{t('templateUnbound')}</option>
                    {props.assets
                      .filter((asset) => asset.type === slot.mediaType)
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name ?? asset.filename ?? asset.id}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              {definition.slots.some(
                (slot) => slot.required && !bindings[slot.id]
              ) && (
                <p className="text-xs text-amber-300">
                  {t('templateDraftUnbound')}
                </p>
              )}
              <fieldset
                disabled={busy}
                className="space-y-2 rounded-lg border border-white/10 p-3"
              >
                <legend className="px-1 text-xs">
                  {t('templatePlacement')}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    {t('templatePlacementX')}
                    <input
                      type="number"
                      step="any"
                      required
                      className={`${control} block w-full`}
                      value={placementX}
                      onChange={(event) => setPlacementX(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    {t('templatePlacementY')}
                    <input
                      type="number"
                      step="any"
                      required
                      className={`${control} block w-full`}
                      value={placementY}
                      onChange={(event) => setPlacementY(event.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
              <button
                type="button"
                className={button}
                disabled={busy || !validPlacement}
                onClick={() => {
                  if (!validPlacement) return;
                  void run(() =>
                    props.onInstantiate({
                      templateId: template.id,
                      templateRevision: template.revision,
                      bindings: Object.fromEntries(
                        Object.entries(bindings).filter(
                          ([, assetId]) => assetId
                        )
                      ),
                      placement: {
                        x: Number(placementX),
                        y: Number(placementY),
                      },
                    })
                  );
                }}
              >
                {t('templateInsert')}
              </button>
              <div className="space-y-2 border-t border-white/10 pt-3">
                <label className="block space-y-1 text-xs">
                  {t('templateName')}
                  <input
                    className={`${control} block w-full`}
                    value={rename}
                    maxLength={200}
                    onChange={(event) => setRename(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={button}
                  disabled={busy || !rename.trim()}
                  onClick={() =>
                    void run(async () => {
                      await props.onRename(
                        template.id,
                        template.revision,
                        rename.trim()
                      );
                      setTemplate(null);
                      setDefinition(null);
                    })
                  }
                >
                  {t('templateRename')}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                >
                  {t('templateRemove')}
                </button>
                {confirmRemove && (
                  <div className="space-y-2 rounded-lg border border-white/10 p-3">
                    <p className="text-xs">{t('templateRemoveImpact')}</p>
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await props.onRemove(template.id, template.revision);
                          setTemplate(null);
                          setDefinition(null);
                          setConfirmRemove(false);
                        })
                      }
                    >
                      {t('templateConfirmRemove')}
                    </button>
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => setConfirmRemove(false)}
                    >
                      {t('templateCancel')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </details>
  );
}
