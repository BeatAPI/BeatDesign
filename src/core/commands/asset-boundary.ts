import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';

import { BeatDesignCommandError } from './contracts';
import type { BeatDesignCommand } from './executor';

type ProjectAsset = NonNullable<
  Awaited<ReturnType<typeof getProjectAssetById>>
>;

const loadCommandAsset = async ({
  projectId,
  assetId,
  expectedType,
}: {
  projectId: string;
  assetId: string;
  expectedType?: 'image' | 'video' | 'audio';
}): Promise<ProjectAsset> => {
  const asset = await getProjectAssetById({ projectId, assetId });
  if (!asset) {
    throw new BeatDesignCommandError(
      'NOT_FOUND',
      `Asset ${assetId} does not belong to this project.`
    );
  }
  if (expectedType && asset.type !== expectedType) {
    throw new BeatDesignCommandError(
      'INVALID_COMMAND',
      `Asset ${assetId} is not a ${expectedType} asset.`
    );
  }
  return asset;
};

export async function normalizeCommandAssetReferences({
  projectId,
  command,
}: {
  projectId: string;
  command: BeatDesignCommand;
}): Promise<BeatDesignCommand> {
  if (command.type === 'editor.validate') return command;

  if (command.type === 'canvas.apply') {
    return {
      ...command,
      operations: await Promise.all(
        command.operations.map(async (operation) => {
          if (operation.type === 'upsert_card' && operation.card.assetId) {
            const expectedType =
              operation.card.type === 'timeline'
                ? 'video'
                : operation.card.type;
            const asset = await loadCommandAsset({
              projectId,
              assetId: operation.card.assetId,
              expectedType,
            });
            return {
              ...operation,
              card: { ...operation.card, url: asset.publicUrl },
            };
          }
          if (
            operation.type === 'upsert_timeline_node' &&
            operation.lastRenderAssetId
          ) {
            const asset = await loadCommandAsset({
              projectId,
              assetId: operation.lastRenderAssetId,
              expectedType: 'video',
            });
            return { ...operation, lastRenderUrl: asset.publicUrl };
          }
          return operation;
        })
      ),
    };
  }

  if (command.type === 'editor.replace_document') {
    const tracks = await Promise.all(
      command.document.tracks.map(async (track) => ({
        ...track,
        clips: await Promise.all(
          track.clips.map(async (clip) => {
            if (clip.sourceType === 'caption') return clip;
            const sourceAsset = await loadCommandAsset({
              projectId,
              assetId: clip.assetId,
              expectedType: clip.sourceType,
            });
            return {
              ...clip,
              sourceUrl: sourceAsset.publicUrl,
              takes: await Promise.all(
                clip.takes.map(async (take) => {
                  const takeAsset = await loadCommandAsset({
                    projectId,
                    assetId: take.assetId,
                    expectedType: 'video',
                  });
                  return { ...take, sourceUrl: takeAsset.publicUrl };
                })
              ),
            };
          })
        ),
      }))
    );
    let lastRenderUrl = command.document.lastRenderUrl;
    if (command.document.lastRenderAssetId) {
      const renderAsset = await loadCommandAsset({
        projectId,
        assetId: command.document.lastRenderAssetId,
        expectedType: 'video',
      });
      lastRenderUrl = renderAsset.publicUrl;
    }
    return {
      ...command,
      document: { ...command.document, tracks, lastRenderUrl },
    };
  }

  return {
    ...command,
    operations: await Promise.all(
      command.operations.map(async (operation) => {
        if (operation.type === 'add_clip') {
          const asset = await loadCommandAsset({
            projectId,
            assetId: operation.assetId,
            expectedType: operation.sourceType,
          });
          return { ...operation, sourceUrl: asset.publicUrl };
        }
        if (operation.type === 'add_overlay') {
          const asset = await loadCommandAsset({
            projectId,
            assetId: operation.assetId,
            expectedType: 'image',
          });
          return { ...operation, sourceUrl: asset.publicUrl };
        }
        if (
          operation.type === 'upsert_caption' ||
          operation.type === 'import_srt' ||
          operation.type === 'set_caption_style' ||
          operation.type === 'update_overlay'
        ) {
          return operation;
        }
        if (operation.type === 'add_take') {
          const asset = await loadCommandAsset({
            projectId,
            assetId: operation.take.assetId,
            expectedType: 'video',
          });
          return {
            ...operation,
            take: { ...operation.take, sourceUrl: asset.publicUrl },
          };
        }
        if (operation.type === 'set_render') {
          const asset = await loadCommandAsset({
            projectId,
            assetId: operation.assetId,
            expectedType: 'video',
          });
          return { ...operation, publicUrl: asset.publicUrl };
        }
        return operation;
      })
    ),
  };
}
