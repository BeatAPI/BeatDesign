import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { executeProjectCommand } from '@/core/commands/client';
import { apiJsonGet } from '@/lib/api-client';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import type {
  OrganizationOperation,
  ProjectOrganizationDocument,
} from '@/core/organization/organization-document';
import {
  ProjectOrganizationPanel,
  type OrganizationAssetQuery,
  type OrganizationPanelAsset,
} from './project-organization-panel';

type OrganizationState = {
  document: ProjectOrganizationDocument;
  revision: number;
  consumers?: Array<{
    elementId: string;
    consumerCardId: string;
    name: string;
  }>;
};
type AssetPage = {
  assets: OrganizationPanelAsset[];
  nextCursor: string | null;
  organizationRevision: number;
};
type PendingCommand = {
  commandId: string;
  operations: OrganizationOperation[];
  expectedRevision: number;
};

export function ProjectOrganizationWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations('Organization');
  const queryClient = useQueryClient();
  const pending = useRef<PendingCommand | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const base = `/api/app/projects/${encodeURIComponent(projectId)}`;
  const organizationKey = ['project-organization', projectId] as const;
  const assetsKey = ['organization-assets', projectId] as const;
  const organization = useQuery({
    queryKey: organizationKey,
    queryFn: () => apiJsonGet<OrganizationState>(`${base}/organization`),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  async function queryAssets(
    input: OrganizationAssetQuery
  ): Promise<AssetPage> {
    const search = new URLSearchParams({
      scope: input.scope,
      query: input.query,
      folderId: input.folderId ?? '',
      limit: '100',
    });
    if (input.cursor) search.set('cursor', input.cursor);
    return apiJsonGet<AssetPage>(`${base}/organization-assets?${search}`);
  }
  const assets = useQuery({
    queryKey: [...assetsKey, organization.data?.revision],
    queryFn: () => queryAssets({ scope: 'project', folderId: null, query: '' }),
    enabled: Boolean(organization.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  async function submit(command: PendingCommand) {
    setError('');
    try {
      const result = await executeProjectCommand({
        projectId,
        command: { type: 'organization.apply', operations: command.operations },
        expectedRevision: command.expectedRevision,
        commandId: command.commandId,
        idempotencyKey: command.commandId,
      });
      // A structured rejection is definitive; retain local form input but no ambiguous request.
      pending.current = null;
      setRetryable(false);
      if (!result.ok) {
        if (result.code === 'REVISION_CONFLICT')
          await queryClient.invalidateQueries({ queryKey: organizationKey });
        throw new Error(result.message);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKey }),
        queryClient.invalidateQueries({ queryKey: assetsKey }),
      ]);
    } catch (cause) {
      // Keep the exact ID, content and original revision after a transport failure.
      if (pending.current) setRetryable(true);
      const detail = cause instanceof Error ? cause.message : t('failed');
      setError(detail);
      throw cause;
    }
  }
  async function apply(
    operations: OrganizationOperation[],
    expectedRevision?: number
  ) {
    if (pending.current) throw new Error(t('retryPending'));
    const command = {
      operations,
      expectedRevision: expectedRevision ?? organization.data?.revision ?? 0,
      commandId: crypto.randomUUID(),
    };
    pending.current = command;
    await submit(command);
  }
  if (!organization.data)
    return (
      <div role="status" className="my-4 text-sm text-[var(--beat-text-3)]">
        {organization.error instanceof Error
          ? organization.error.message
          : t('loading')}
        {organization.isError && (
          <button
            type="button"
            className="ml-3 min-h-11 rounded border border-white/15 px-3"
            onClick={() => void organization.refetch()}
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  return (
    <div>
      {(error || retryable) && (
        <div
          role="alert"
          className="my-3 rounded-lg border border-orange-500/30 p-3 text-sm"
        >
          <p>{error}</p>
          {retryable && (
            <>
              <p>{t('retryPending')}</p>
              <button
                type="button"
                disabled={retrying}
                className="mt-2 min-h-11 rounded border border-white/15 px-3 disabled:opacity-40"
                onClick={() => {
                  const command = pending.current;
                  if (!command) return;
                  setRetrying(true);
                  void submit(command)
                    .catch(() => undefined)
                    .finally(() => setRetrying(false));
                }}
              >
                {t('retry')}
              </button>
            </>
          )}
        </div>
      )}
      {assets.error instanceof Error && (
        <p role="alert" className="text-sm text-red-400">
          {assets.error.message}
        </p>
      )}
      <ProjectOrganizationPanel
        consumers={organization.data.consumers}
        onLocateConsumer={(id) => {
          window.location.assign(
            `/canvas/${encodeURIComponent(projectId)}?focus=${encodeURIComponent(id)}`
          );
        }}
        document={organization.data.document}
        revision={organization.data.revision}
        assets={assets.data?.assets ?? []}
        onApply={apply}
        onQuery={queryAssets}
      />
    </div>
  );
}
