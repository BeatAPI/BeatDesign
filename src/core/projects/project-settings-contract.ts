import { z } from 'zod';

export const projectSettingsPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(140).optional(),
    cover: z
      .discriminatedUnion('mode', [
        z.object({ mode: z.literal('auto') }).strict(),
        z
          .object({
            mode: z.literal('manual'),
            assetId: z.string().trim().min(1).max(200),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Include at least one setting.',
  );

export type ProjectSettingsPatch = z.infer<typeof projectSettingsPatchSchema>;
export type ProjectSettings = {
  id: string;
  name: string;
  description: string;
  coverMode: 'auto' | 'manual';
  coverAssetId: string | null;
  coverImageUrl: string | null;
  automaticCoverImageUrl: string | null;
  settingsRevision: number;
  createdAt: string;
};
