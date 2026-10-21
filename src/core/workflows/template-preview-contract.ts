import { z } from 'zod';

const id = z.string().trim().min(1).max(200);
export const templatePreviewInputSchema = z.union([
  z.object({ selectedCardIds: z.array(id).min(1).max(100) }).strict(),
  z
    .object({
      templateId: id,
      templateRevision: z.number().int().positive(),
      instanceId: id,
      bindings: z
        .record(
          id,
          z
            .object({
              assetId: id,
              elementId: id.optional(),
              versionId: id.optional(),
            })
            .strict()
            .refine(
              (value) => Boolean(value.elementId) === Boolean(value.versionId),
              'Element and version must be supplied together'
            )
        )
        .default({}),
      placement: z
        .object({ x: z.number().finite(), y: z.number().finite() })
        .strict(),
    })
    .strict(),
]);
export type TemplatePreviewInput = z.infer<typeof templatePreviewInputSchema>;
