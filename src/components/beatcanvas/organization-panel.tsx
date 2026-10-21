import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import type { BeatDesignCommand } from '@/core/commands/executor';
import type { CanvasOperation } from '@/core/commands/canvas-commands';
import type { ProjectOrganizationDocument } from '@/core/organization/organization-document';
import {
  WorkflowTemplatePanel,
  type WorkflowTemplateSummary,
} from './workflow-template-panel';
import type { WorkflowTemplateDefinition } from '@/core/workflows/workflow-template';

type Props = {
  projectId: string;
  selectedCardIds: string[];
  getDocument: () => ProjectSnapshotDocument;
  flush: () => Promise<void>;
  acceptSnapshot: (document: ProjectSnapshotDocument, revision: number) => void;
  onLocate: (id: string) => void;
};
const control =
  'min-h-11 rounded-lg border border-white/15 bg-[var(--beat-surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-40';
const headers = {
  'content-type': 'application/json',
  'x-beatapi-workspace-request': '1',
};
async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? data.message ?? response.statusText);
  return data;
}

export function CanvasOrganizationPanel(props: Props) {
  const t = useTranslations('Organization');
  const capturePreviewRef = useRef<{
    selectedCardIds: string[];
    sourceCanvasRevision: number;
    definitionDigest: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [layoutGroupIds, setLayoutGroupIds] = useState<string[]>([]);
  const [role, setRole] = useState<
    'shot' | 'references' | 'sound' | 'packaging' | 'timeline'
  >('shot');
  const [preview, setPreview] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [organization, setOrganization] =
    useState<ProjectOrganizationDocument | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [assets, setAssets] = useState<
    Array<{ id: string; filename?: string; type: string }>
  >([]);
  const [assetQuery, setAssetQuery] = useState('');
  const [elementId, setElementId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [referenceRole, setReferenceRole] = useState<
    'reference' | 'style' | 'subject' | 'pose' | 'audio_track' | 'source'
  >('reference');
  const [timelineUsage, setTimelineUsage] = useState<
    Array<{
      assetId: string | null;
      clipId: string;
      name: string;
      takeId: string | null;
      trackId: string;
      sourceType: string;
      sourceUrl: string | null;
      timelineStart: number;
      duration: number;
      sourceIn: number;
      sourceOut: number;
      hidden: boolean;
      muted: boolean;
    }>
  >([]);
  const [pending, setPending] = useState<{ body: string } | null>(null);
  const base = `/api/app/projects/${encodeURIComponent(props.projectId)}`;
  async function refresh() {
    const [org, library, page] = await Promise.all([
      readJson(`${base}/organization`),
      readJson('/api/app/workflow-templates/'),
      readJson(`${base}/organization-assets?limit=500`),
    ]);
    setOrganization(org.document);
    setTemplates(Array.isArray(library) ? library : library.templates);
    setAssets(page.assets);
  }
  useEffect(() => {
    let live = true;
    const poll = () => {
      if (live && document.visibilityState === 'visible')
        void refresh().catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [props.projectId]);
  async function finish(body: string) {
    const response = await fetch(`${base}/commands`, {
      method: 'POST',
      headers,
      body,
    });
    const result = await response.json();
    setPending(null);
    if (!result.ok)
      throw new Error(result.message ?? result.error ?? t('failed'));
    setNotices([...(result.warnings ?? []), ...(result.data?.blockers ?? [])]);
    if (result.data?.canvas)
      props.acceptSnapshot(result.data.canvas, result.revision);
    await refresh();
    return result;
  }
  async function mutate(command: BeatDesignCommand, revision?: number) {
    if (pending) throw new Error(t('retryPending'));
    await props.flush();
    if (command.type === 'workflow.template.capture') {
      // Layout/viewport autosaves may advance the Canvas after preview. Re-read
      // only to verify the exact reviewed definition; never adopt changed content.
      const latest = await readJson(`${base}/template-preview`, {
        method: 'POST', headers,
        body: JSON.stringify({selectedCardIds: command.selectedCardIds}),
      });
      if (latest.definitionDigest !== command.definitionDigest) throw new Error(t('reviewLatest'));
      command = {...command, sourceCanvasRevision: latest.sourceCanvasRevision};
    }
    const expectedRevision =
      revision ?? (await readJson(`${base}/snapshot`)).version;
    const commandId = crypto.randomUUID();
    const body = JSON.stringify({
      commandId,
      idempotencyKey: commandId,
      expectedRevision,
      command,
    });
    setPending({ body });
    return finish(body);
  }
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
  const apply = (operations: CanvasOperation[]) =>
    mutate({ type: 'canvas.apply', operations });
  const canvas = props.getDocument();
  const groups = Object.values(canvas.organization?.groups ?? {});
  const layoutTargets = layoutGroupIds.filter((id) =>
    groups.some((group) => group.id === id)
  );
  const selected = props.selectedCardIds
    .map((id) => canvas.cards.find((card) => card.id === id))
    .filter((card) => !!card);
  const consumer =
    selected.length === 1 && selected[0].kind === 'generation'
      ? selected[0]
      : null;
  const elements = Object.values(organization?.elements ?? {}).filter(
    (element) => !element.deletedAt
  );
  const element = elements.find((value) => value.id === elementId);
  function slotOwner(bindingId: string) {
    for (const instance of Object.values(
      canvas.organization?.templateInstances ?? {}
    ))
      for (const slot of instance.slotDefinitions)
        for (const consumer of slot.consumers)
          if (`${instance.id}:${slot.id}:${consumer.stepId}` === bindingId)
            return { instance, slot };
    return null;
  }
  function unbindOperation(bindingId: string): CanvasOperation {
    const owner = slotOwner(bindingId);
    return owner
      ? {
          type: 'unbind_template_slot',
          instanceId: owner.instance.id,
          slotId: owner.slot.id,
        }
      : { type: 'unbind_element', bindingId };
  }
  async function adoptBinding(
    binding: NonNullable<
      ProjectSnapshotDocument['organization']
    >['elementBindings'][string]
  ) {
    const current = organization!.elements[binding.elementId];
    const owner = slotOwner(binding.id);
    if (owner)
      return apply([
        {
          type: 'bind_template_slot',
          instanceId: owner.instance.id,
          slotId: owner.slot.id,
          binding: {
            assetId: current.versions[current.currentVersionId].assetId,
            referenceCardId: crypto.randomUUID(),
            elementId: current.id,
            versionId: current.currentVersionId,
          },
        },
      ]);
    return apply([
      {
        type: 'review_element_binding',
        bindingId: binding.id,
        observedCurrentVersionId: current.currentVersionId,
        decision: 'adopt',
        binding: {
          ...binding,
          versionId: current.currentVersionId,
          assetId: current.versions[current.currentVersionId].assetId,
          referenceCardId: crypto.randomUUID(),
          reviewedAgainstCurrentVersionId: current.currentVersionId,
        },
      },
    ]);
  }
  async function locateCard(id: string, document = canvas) {
    const selected = document.cards.find((card) => card.id === id);
    const targetId =
      selected?.kind === 'output' ? selected.sourceConfigCardId : id;
    const group = Object.values(document.organization?.groups ?? {}).find(
      (group) => group.id === id || group.memberCardIds.includes(targetId)
    );
    if (group?.collapsed)
      await apply([
        { type: 'set_group_collapsed', groupId: group.id, collapsed: false },
      ]);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        props.onLocate(group?.id === id ? group.memberCardIds[0] : targetId)
      )
    );
  }
  function previewExactCard(id: string) {
    const card = canvas.cards.find((card) => card.id === id);
    if (card?.url && (card.type === 'image' || card.type === 'video'))
      window.dispatchEvent(
        new CustomEvent('beatcanvas:preview-media', {
          detail: { type: card.type, url: card.url, title: card.name },
        })
      );
  }
  async function createGroup() {
    const groupId = crypto.randomUUID();
    const ids = preview ?? [];
    const frames = ids.map((id) => canvas.frames[id]).filter(Boolean);
    if (!frames.length) throw new Error(t('chooseNodes'));
    const x = Math.min(...frames.map((frame) => frame.x)) - 24,
      y = Math.min(...frames.map((frame) => frame.y)) - 60;
    const expandedFrame = {
      x,
      y,
      w: Math.max(...frames.map((frame) => frame.x + frame.w)) - x + 24,
      h: Math.max(...frames.map((frame) => frame.y + frame.h)) - y + 24,
    };
    await apply([
      {
        type: 'create_group',
        groupId,
        name: name.trim(),
        role,
        memberCardIds: ids,
        summaryFrame: { x, y, w: 320, h: 160 },
        expandedFrame,
      },
      { type: 'fit_group', groupId },
    ]);
    setPreview(null);
    setName('');
  }
  return (
    <details
      className="pointer-events-auto absolute right-4 top-4 z-20 max-h-[75vh] w-[min(380px,calc(100%_-_32px))] overflow-auto rounded-xl border border-white/10 bg-[var(--beat-panel,#111214)] text-[var(--beat-text-1)] shadow-lg"
      data-testid="canvas-organization-panel"
    >
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-orange-500">
        {t('canvasOrganization')}
      </summary>
      <div className="space-y-4 border-t border-white/10 p-4">
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {notices.length > 0 && (
          <ul role="status" className="space-y-1 text-xs text-orange-300">
            {notices.map((notice, index) => (
              <li key={index}>{notice}</li>
            ))}
          </ul>
        )}
        {pending && (
          <button
            className={control}
            disabled={busy}
            onClick={() => void run(() => finish(pending.body))}
          >
            {t('retry')}
          </button>
        )}
        <section className="space-y-2" aria-label={t('groups')}>
          <fieldset
            className="space-y-2 rounded-lg border border-white/10 p-2"
            disabled={busy || !groups.length}
          >
            <legend className="px-1 text-xs">{t('arrangeGroups')}</legend>
            <p className="text-xs text-[var(--beat-text-3)]">
              {t('arrangeTargets', {
                count: layoutTargets.length || groups.length,
              })}
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('arrangeGroups')}
            >
              {(['tidy', 'row', 'column'] as const).map((mode) => (
                <button
                  key={mode}
                  className={control}
                  onClick={() =>
                    void run(() =>
                      apply([
                        {
                          type: 'arrange_groups',
                          groupIds: layoutTargets.length
                            ? layoutTargets
                            : groups.map((group) => group.id),
                          mode,
                        },
                      ])
                    )
                  }
                >
                  {t(`layout_${mode}`)}
                </button>
              ))}
            </div>
            <button
              className={`${control} w-full`}
              onClick={() =>
                void run(() =>
                  apply([
                    ...groups.flatMap((group) => [
                      {
                        type: 'set_group_collapsed' as const,
                        groupId: group.id,
                        collapsed: false,
                      },
                      {
                        type: 'layout_group' as const,
                        groupId: group.id,
                        mode: 'row' as const,
                      },
                    ]),
                    {
                      type: 'arrange_groups',
                      groupIds: groups.map((group) => group.id),
                      mode: 'tidy',
                    },
                  ])
                )
              }
            >
              {t('expandArrangeAll')}
            </button>
            <p className="text-xs text-[var(--beat-text-3)]">
              {t('layoutHelp')}
            </p>
          </fieldset>
          <label className="block text-xs">
            {t('groupName')}
            <input
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              className={`${control} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs">
            {t('groupRole')}
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as typeof role)}
              className={`${control} mt-1 w-full`}
            >
              {(
                [
                  'shot',
                  'references',
                  'sound',
                  'packaging',
                  'timeline',
                ] as const
              ).map((value) => (
                <option value={value} key={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <button
            className={control}
            disabled={busy || !selected.length}
            onClick={() => setPreview(selected.map((card) => card.id))}
          >
            {t('previewGroup')}
          </button>
          {preview && (
            <div className="space-y-2 rounded-lg border border-white/10 p-2">
              <p className="text-xs">
                {t('groupPreview', { count: preview.length })}
              </p>
              <ul className="text-xs">
                {preview.map((id) => (
                  <li key={id}>
                    {canvas.cards.find((card) => card.id === id)?.name ?? id}
                  </li>
                ))}
              </ul>
              <button
                className={control}
                disabled={busy || !name.trim()}
                onClick={() => void run(createGroup)}
              >
                {t('createGroup')}
              </button>
            </div>
          )}
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={canvas.organization?.view.historyMode === 'all'}
              onChange={(event) =>
                void run(() =>
                  apply([
                    {
                      type: 'set_organization_view',
                      historyMode: event.target.checked ? 'all' : 'current',
                    },
                  ])
                )
              }
            />
            {t('showHistory')}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={canvas.organization?.view.referenceMode === 'all'}
              onChange={(event) =>
                void run(() =>
                  apply([
                    {
                      type: 'set_organization_view',
                      referenceMode: event.target.checked ? 'all' : 'focused',
                    },
                  ])
                )
              }
            />
            {t('showAllReferences')}
          </label>
          {groups.map((group) => (
            <div
              key={group.id}
              data-testid={`group-settings-${group.id}`}
              className="space-y-2 rounded-lg border border-white/10 p-2"
            >
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={layoutGroupIds.includes(group.id)}
                  onChange={(event) =>
                    setLayoutGroupIds((current) =>
                      event.target.checked
                        ? [...current, group.id]
                        : current.filter((id) => id !== group.id)
                    )
                  }
                />
                {t('selectLayoutGroup', { name: group.name })}
              </label>
              <input
                aria-label={t('groupName')}
                key={`${group.id}:${group.name}`}
                defaultValue={group.name}
                maxLength={200}
                className={`${control} w-full`}
                onBlur={(event) => {
                  if (
                    event.target.value.trim() &&
                    event.target.value.trim() !== group.name
                  )
                    void run(() =>
                      apply([
                        {
                          type: 'update_group',
                          groupId: group.id,
                          name: event.target.value.trim(),
                        },
                      ])
                    );
                }}
              />
              <p className="text-xs text-[var(--beat-text-3)]">
                {t(group.role)} · {group.memberCardIds.length}
              </p>
              <label className="block text-xs">
                {t('displayedResult')}
                <select
                  className={`${control} mt-1 w-full`}
                  value={group.resultCardId ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    void run(() =>
                      apply([
                        {
                          type: 'update_group',
                          groupId: group.id,
                          resultCardId: event.target.value || null,
                        },
                      ])
                    )
                  }
                >
                  <option value="">{t('noResult')}</option>
                  {group.memberCardIds
                    .map((id) => canvas.cards.find((card) => card.id === id))
                    .filter((card) => card && card.kind !== 'text')
                    .map((card) => (
                      <option key={card!.id} value={card!.id}>
                        {card!.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={control}
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      apply([
                        {
                          type: 'set_group_collapsed',
                          groupId: group.id,
                          collapsed: !group.collapsed,
                        },
                      ])
                    )
                  }
                >
                  {t(group.collapsed ? 'expand' : 'collapse')}
                </button>
                <button
                  className={control}
                  onClick={() =>
                    void run(() =>
                      locateCard(
                        group.collapsed ? group.id : group.memberCardIds[0]
                      )
                    )
                  }
                >
                  {t('locate')}
                </button>
                <button
                  className={control}
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      apply([{ type: 'remove_group', groupId: group.id }])
                    )
                  }
                >
                  {t('ungroup')}
                </button>
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t('groupLayout')}
              >
                {(['tidy', 'row', 'column', 'fit'] as const).map((mode) => (
                  <button
                    key={mode}
                    className={control}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        apply([
                          mode === 'fit'
                            ? { type: 'fit_group', groupId: group.id }
                            : { type: 'layout_group', groupId: group.id, mode },
                        ])
                      )
                    }
                  >
                    {t(`layout_${mode}`)}
                  </button>
                ))}
              </div>
              <button
                className={control}
                disabled={busy || !selected.length}
                onClick={() =>
                  void run(() =>
                    apply([
                      {
                        type: 'set_group_members',
                        groupId: group.id,
                        memberCardIds: selected.map((card) => card.id),
                      },
                    ])
                  )
                }
              >
                {t('useSelection')}
              </button>
            </div>
          ))}
        </section>
        <section
          className="space-y-2 border-t border-white/10 pt-3"
          aria-label={t('elements')}
        >
          <p className="text-xs">{t('selectConsumer')}</p>
          <select
            aria-label={t('element')}
            className={`${control} w-full`}
            value={elementId}
            onChange={(event) => {
              const value = elements.find((e) => e.id === event.target.value);
              setElementId(event.target.value);
              setVersionId(value?.currentVersionId ?? '');
            }}
          >
            <option value="">{t('element')}</option>
            {elements.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('versions')}
            className={`${control} w-full`}
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
          >
            {Object.values(element?.versions ?? {}).map((value) => (
              <option value={value.id} key={value.id}>
                {value.id}
                {value.id === element?.currentVersionId
                  ? ` · ${t('current')}`
                  : ''}
              </option>
            ))}
          </select>
          <select
            aria-label={t('inputRole')}
            className={`${control} w-full`}
            value={referenceRole}
            onChange={(event) =>
              setReferenceRole(event.target.value as typeof referenceRole)
            }
          >
            {(
              [
                'reference',
                'subject',
                'style',
                'pose',
                'source',
                'audio_track',
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {t(`input_${value}`)}
              </option>
            ))}
          </select>
          <button
            className={control}
            disabled={busy || !consumer || !element?.versions[versionId]}
            onClick={() =>
              void run(() =>
                apply([
                  {
                    type: 'bind_element',
                    bindingId: crypto.randomUUID(),
                    consumerCardId: consumer!.id,
                    elementId,
                    versionId,
                    assetId: element!.versions[versionId].assetId,
                    referenceCardId: crypto.randomUUID(),
                    order: consumer!.referenceCardIds.length,
                    role: referenceRole,
                  },
                ])
              )
            }
          >
            {t('bindElement')}
          </button>
          {Object.values(canvas.organization?.elementBindings ?? {}).map(
            (binding) => {
              const current = organization?.elements[binding.elementId];
              const needsReview =
                current &&
                current.currentVersionId !==
                  binding.reviewedAgainstCurrentVersionId;
              return (
                <div
                  className="space-y-2 rounded-lg border border-white/10 p-2 text-xs"
                  key={binding.id}
                >
                  <button
                    className="min-h-11 text-left"
                    onClick={() =>
                      void run(() => locateCard(binding.consumerCardId))
                    }
                  >
                    {current?.name ?? binding.elementId} · {binding.versionId} →{' '}
                    {
                      canvas.cards.find((c) => c.id === binding.consumerCardId)
                        ?.name
                    }
                  </button>
                  <p>
                    {t('referencePosition', { position: binding.order + 1 })} ·{' '}
                    {t(`input_${binding.role}`)} ·{' '}
                    {canvas.cards.find(
                      (card) => card.id === binding.referenceCardId
                    )?.name ?? binding.assetId}
                  </p>
                  {needsReview && (
                    <>
                      <p>{t('needsReview')}</p>
                      <button
                        className={control}
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            apply([
                              {
                                type: 'review_element_binding',
                                bindingId: binding.id,
                                observedCurrentVersionId:
                                  current.currentVersionId,
                                decision: 'keep',
                              },
                            ])
                          )
                        }
                      >
                        {t('keepVersion')}
                      </button>
                      <button
                        className={control}
                        disabled={busy}
                        onClick={() => void run(() => adoptBinding(binding))}
                      >
                        {t('adoptVersion')}
                      </button>
                    </>
                  )}
                  <button
                    className={control}
                    disabled={busy}
                    onClick={() =>
                      void run(() => apply([unbindOperation(binding.id)]))
                    }
                  >
                    {t('unbind')}
                  </button>
                </div>
              );
            }
          )}
        </section>
        <section className="space-y-2 border-t border-white/10 pt-3">
          <label className="block text-xs">
            {t('search')}
            <input
              className={`${control} mt-1 w-full`}
              value={assetQuery}
              onChange={(event) => setAssetQuery(event.target.value)}
            />
          </label>
          <button
            className={control}
            onClick={() =>
              void run(async () =>
                setAssets(
                  (
                    await readJson(
                      `${base}/organization-assets?limit=500&query=${encodeURIComponent(assetQuery)}`
                    )
                  ).assets
                )
              )
            }
          >
            {t('search')}
          </button>
          {Object.values(canvas.organization?.templateInstances ?? {}).map(
            (instance) => (
              <div
                key={instance.id}
                className="space-y-2 rounded-lg border border-white/10 p-2"
              >
                <p className="text-xs">
                  {t('templateInputs')} · {instance.templateRevision}
                </p>
                {instance.slotDefinitions.map((slot) => (
                  <label key={slot.id} className="block text-xs">
                    {slot.label} ·{' '}
                    {slot.required ? t('templateRequired') : slot.mediaType}
                    <select
                      className={`${control} mt-1 w-full`}
                      value={
                        instance.slotBindings[slot.id]
                          ? JSON.stringify({
                              assetId: instance.slotBindings[slot.id].assetId,
                              ...(instance.slotBindings[slot.id].elementId
                                ? {
                                    elementId:
                                      instance.slotBindings[slot.id].elementId,
                                    versionId:
                                      instance.slotBindings[slot.id].versionId,
                                  }
                                : {}),
                            })
                          : ''
                      }
                      disabled={busy}
                      onChange={(event) =>
                        void run(() =>
                          event.target.value
                            ? apply([
                                {
                                  type: 'bind_template_slot',
                                  instanceId: instance.id,
                                  slotId: slot.id,
                                  binding: {
                                    ...JSON.parse(event.target.value),
                                    referenceCardId: crypto.randomUUID(),
                                  },
                                },
                              ])
                            : apply([
                                {
                                  type: 'unbind_template_slot',
                                  instanceId: instance.id,
                                  slotId: slot.id,
                                },
                              ])
                        )
                      }
                    >
                      <option value="">{t('templateUnbound')}</option>
                      {assets
                        .filter((asset) => asset.type === slot.mediaType)
                        .map((asset) => (
                          <option
                            key={asset.id}
                            value={JSON.stringify({ assetId: asset.id })}
                          >
                            {asset.filename ?? asset.id}
                          </option>
                        ))}
                      {elements.flatMap((element) =>
                        Object.values(element.versions)
                          .filter(
                            (version) => version.mediaType === slot.mediaType
                          )
                          .map((version) => (
                            <option
                              key={`${element.id}:${version.id}`}
                              value={JSON.stringify({
                                assetId: version.assetId,
                                elementId: element.id,
                                versionId: version.id,
                              })}
                            >
                              {element.name} · {version.id}
                            </option>
                          ))
                      )}
                    </select>
                  </label>
                ))}
                <button
                  className={control}
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      apply([
                        {
                          type: 'detach_template_instance',
                          instanceId: instance.id,
                        },
                      ])
                    )
                  }
                >
                  {t('detachTemplate')}
                </button>
              </div>
            )
          )}
        </section>
        <WorkflowTemplatePanel
          templates={templates}
          assets={assets}
          selectedCount={selected.length}
          onPreviewCapture={async () => {
            const selectedCardIds = [...props.selectedCardIds];
            await props.flush();
            const data = await readJson(`${base}/template-preview`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ selectedCardIds }),
            });
            capturePreviewRef.current = {
              selectedCardIds,
              sourceCanvasRevision: data.sourceCanvasRevision,
              definitionDigest: data.definitionDigest,
            };
            return data.definition as WorkflowTemplateDefinition;
          }}
          onCapture={async (name, definitionDigest) => {
            const preview = capturePreviewRef.current;
            if (!preview || preview.definitionDigest !== definitionDigest)
              throw new Error(t('reviewLatest'));
            const result = await mutate(
              {
                type: 'workflow.template.capture',
                templateId: crypto.randomUUID(),
                name,
                ...preview,
              },
              0
            );
            capturePreviewRef.current = null;
            return result;
          }}
          onLoadDefinition={async (id) =>
            (
              await readJson(
                `/api/app/workflow-templates/${encodeURIComponent(id)}`
              )
            ).definition
          }
          onInstantiate={async (input) => {
            const result = await mutate({
              type: 'workflow.template.instantiate',
              ...input,
              instanceId: crypto.randomUUID(),
              bindings: Object.fromEntries(
                Object.entries(input.bindings).map(([slot, assetId]) => [
                  slot,
                  { assetId },
                ])
              ),
              placement: input.placement,
            });
            const inserted = result.data?.canvas?.cards.find((card: {id:string;kind:string}) =>
              result.changedIds?.includes(card.id) && card.kind === 'generation'
            );
            if (inserted) await locateCard(inserted.id, result.data.canvas);
            return result;
          }}
          onRename={(templateId, revision, name) =>
            mutate(
              { type: 'workflow.template.rename', templateId, name },
              revision
            )
          }
          onRemove={(templateId, revision) =>
            mutate({ type: 'workflow.template.remove', templateId }, revision)
          }
        />
        <section className="space-y-2 border-t border-white/10 pt-3">
          <button
            className={control}
            onClick={() =>
              void run(async () =>
                setTimelineUsage(
                  (await readJson(`${base}/timeline-usage`)).clips
                )
              )
            }
          >
            {t('timelineUsage')}
          </button>
          {timelineUsage.map((clip) => (
            <div key={clip.clipId} className="text-xs">
              <p>
                {clip.name}
                {clip.takeId ? ` · ${t('activeTake')}` : ''}
              </p>
              <p>
                {t('timelineRange', {
                  start: clip.timelineStart,
                  duration: clip.duration,
                  sourceIn: clip.sourceIn,
                  sourceOut: clip.sourceOut,
                })}
              </p>
              <p>
                {clip.sourceType === 'caption' ? t('caption') : clip.assetId} ·{' '}
                {clip.trackId}
                {clip.hidden ? ` · ${t('hidden')}` : ''}
                {clip.muted ? ` · ${t('muted')}` : ''}
              </p>
              {clip.sourceUrl &&
                (clip.sourceType === 'video' ||
                  clip.sourceType === 'image') && (
                  <button
                    className={control}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('beatcanvas:preview-media', {
                          detail: {
                            type: clip.sourceType,
                            url: clip.sourceUrl,
                            title: clip.name,
                          },
                        })
                      )
                    }
                  >
                    {t('previewAdopted')}
                  </button>
                )}
              {clip.sourceUrl && clip.sourceType === 'audio' && (
                <audio preload="none" controls src={clip.sourceUrl} />
              )}
              {canvas.cards
                .filter((card) => card.assetId === clip.assetId)
                .map((card) => (
                  <button
                    className={control}
                    key={card.id}
                    onClick={() =>
                      void run(async () => {
                        previewExactCard(card.id);
                        await locateCard(card.id);
                      })
                    }
                  >
                    {t('locate')} · {card.name}
                  </button>
                ))}
            </div>
          ))}
        </section>
      </div>
    </details>
  );
}
