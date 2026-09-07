import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import * as z from 'zod/v4';

export const BEATDESIGN_SKILL_SCHEMA_VERSION = 1;
export const BEATDESIGN_SKILL_CATALOG_URI = 'beatdesign://skills';
export const BEATDESIGN_SKILL_RESOURCE_TEMPLATE =
  'beatdesign://skills/{skillId}';

const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_INSTRUCTIONS_BYTES = 512 * 1024;

export const beatDesignSkillIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const semanticVersionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

const skillInputSchema = z
  .object({
    id: beatDesignSkillIdSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    kind: z.enum(['text', 'image', 'video', 'audio', 'number', 'boolean']),
    required: z.boolean().default(true),
  })
  .strict();

const skillStageSchema = z
  .object({
    id: beatDesignSkillIdSchema,
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    reviewRequired: z.boolean().default(false),
  })
  .strict();

export const beatDesignSkillManifestSchema = z
  .object({
    schemaVersion: z.literal(BEATDESIGN_SKILL_SCHEMA_VERSION),
    id: beatDesignSkillIdSchema,
    version: semanticVersionSchema,
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    visibility: z.enum(['showcase', 'hidden']).default('showcase'),
    compatibility: z
      .object({
        minimumBeatDesignVersion: semanticVersionSchema,
        requiredMcpTools: z
          .array(z.string().regex(/^bdesign_[a-z0-9_]+$/))
          .max(100)
          .default([]),
      })
      .strict(),
    requiredCapabilities: z
      .array(beatDesignSkillIdSchema)
      .max(50)
      .default([]),
    inputs: z.array(skillInputSchema).max(32).default([]),
    stages: z.array(skillStageSchema).max(32).default([]),
    showcase: z
      .object({
        category: beatDesignSkillIdSchema,
        tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
        featured: z.boolean().default(false),
      })
      .strict()
      .optional(),
  })
  .strict();

export type BeatDesignSkillManifest = z.infer<
  typeof beatDesignSkillManifestSchema
>;

export type BeatDesignSkillDefinition = {
  manifest: BeatDesignSkillManifest;
  instructions: string;
};

export type BeatDesignSkill = BeatDesignSkillDefinition & {
  resourceUri: string;
  compatible: boolean;
  incompatibilities: string[];
};

export type BeatDesignSkillDescriptor = Omit<BeatDesignSkill, 'instructions'>;

export type BeatDesignSkillCatalog = {
  schemaVersion: typeof BEATDESIGN_SKILL_SCHEMA_VERSION;
  beatDesignVersion: string;
  skills: BeatDesignSkillDescriptor[];
};

const parseVersion = (value: string) =>
  value
    .split('-', 1)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10)) as [number, number, number];

export const isBeatDesignVersionCompatible = (
  currentVersion: string,
  minimumVersion: string
) => {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumVersion);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
};

export const buildBeatDesignSkillResourceUri = (skillId: string) =>
  `${BEATDESIGN_SKILL_CATALOG_URI}/${encodeURIComponent(skillId)}`;

export function createBeatDesignSkillRegistry({
  definitions,
  beatDesignVersion,
  availableMcpTools,
}: {
  definitions: readonly BeatDesignSkillDefinition[];
  beatDesignVersion: string;
  availableMcpTools: readonly string[];
}) {
  semanticVersionSchema.parse(beatDesignVersion);
  const availableTools = new Set(availableMcpTools);
  const skills = definitions.map((definition) => {
    const manifest = beatDesignSkillManifestSchema.parse(definition.manifest);
    const instructions = z
      .string()
      .trim()
      .min(1)
      .max(MAX_INSTRUCTIONS_BYTES)
      .parse(definition.instructions);
    const incompatibilities: string[] = [];
    if (
      !isBeatDesignVersionCompatible(
        beatDesignVersion,
        manifest.compatibility.minimumBeatDesignVersion
      )
    ) {
      incompatibilities.push(
        `Requires BeatDesign ${manifest.compatibility.minimumBeatDesignVersion} or newer.`
      );
    }
    const missingTools = manifest.compatibility.requiredMcpTools.filter(
      (tool) => !availableTools.has(tool)
    );
    if (missingTools.length > 0) {
      incompatibilities.push(`Missing MCP tools: ${missingTools.join(', ')}.`);
    }
    return {
      manifest,
      instructions,
      resourceUri: buildBeatDesignSkillResourceUri(manifest.id),
      compatible: incompatibilities.length === 0,
      incompatibilities,
    } satisfies BeatDesignSkill;
  });

  const byId = new Map<string, BeatDesignSkill>();
  for (const skill of skills) {
    if (byId.has(skill.manifest.id)) {
      throw new Error(`Duplicate BeatDesign Skill id: ${skill.manifest.id}`);
    }
    byId.set(skill.manifest.id, skill);
  }

  const ordered = [...skills].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id)
  );

  return {
    list: (): BeatDesignSkillDescriptor[] =>
      ordered.map(({ instructions: _instructions, ...descriptor }) => descriptor),
    get: (skillId: string): BeatDesignSkill | null => byId.get(skillId) ?? null,
    catalog: (): BeatDesignSkillCatalog => ({
      schemaVersion: BEATDESIGN_SKILL_SCHEMA_VERSION,
      beatDesignVersion,
      skills: ordered.map(({ instructions: _instructions, ...descriptor }) =>
        descriptor
      ),
    }),
  };
}

const readBoundedTextFile = async (path: string, maxBytes: number) => {
  const contents = await readFile(path);
  if (contents.byteLength > maxBytes) {
    throw new Error(`BeatDesign Skill file is too large: ${path}`);
  }
  return contents.toString('utf8');
};

export async function loadBeatDesignSkillRegistry({
  directory,
  beatDesignVersion,
  availableMcpTools,
}: {
  directory: string;
  beatDesignVersion: string;
  availableMcpTools: readonly string[];
}) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createBeatDesignSkillRegistry({
        definitions: [],
        beatDesignVersion,
        availableMcpTools,
      });
    }
    throw error;
  }

  const definitions = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const skillDirectory = resolve(directory, entry.name);
        const [manifestText, instructions] = await Promise.all([
          readBoundedTextFile(
            resolve(skillDirectory, 'skill.json'),
            MAX_MANIFEST_BYTES
          ),
          readBoundedTextFile(
            resolve(skillDirectory, 'SKILL.md'),
            MAX_INSTRUCTIONS_BYTES
          ),
        ]);
        const manifest = beatDesignSkillManifestSchema.parse(
          JSON.parse(manifestText) as unknown
        );
        if (manifest.id !== entry.name) {
          throw new Error(
            `BeatDesign Skill directory ${entry.name} must match manifest id ${manifest.id}.`
          );
        }
        return { manifest, instructions };
      })
  );

  return createBeatDesignSkillRegistry({
    definitions,
    beatDesignVersion,
    availableMcpTools,
  });
}
