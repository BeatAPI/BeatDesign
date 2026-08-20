type OutputRecord = Record<string, unknown>;

const asObject = (value: unknown): OutputRecord | null =>
  value && typeof value === 'object' ? (value as OutputRecord) : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : null;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      )
    : [];

const readObjectArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => asObject(item))
        .filter((item): item is OutputRecord => item !== null)
    : [];

const dedupeStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const parseJsonRecord = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as OutputRecord)
      : null;
  } catch {
    return null;
  }
};

const collectCandidateRecords = (output: unknown) => {
  const records: OutputRecord[] = [];
  const append = (value: unknown) => {
    const record = asObject(value);
    if (record) records.push(record);
  };

  const root = asObject(output);
  if (!root) return records;

  append(root);
  append(root.response);
  append(root.info);
  append(root.raw);
  append(root.data);
  append(root.result);

  const data = asObject(root.data);
  const result = asObject(root.result);
  append(data?.result);
  append(result?.data);

  const providerMetadata = asObject(root.providerMetadata);
  const rawOutput = asObject(providerMetadata?.rawOutput);
  append(rawOutput);
  append(rawOutput?.raw);

  for (const record of [...records]) {
    append(parseJsonRecord(record.resultJson));
  }

  return records;
};

export const resolveOutputMedia = (output: unknown) => {
  const records = collectCandidateRecords(output);
  const creationRecords = records.flatMap((record) =>
    readObjectArray(record.creations)
  );
  const storedResultUrl = records
    .map((record) => readString(record.stored_result_url))
    .find(Boolean);
  const providerResultUrl = records
    .map((record) => readString(record.provider_result_url))
    .find(Boolean);
  const storedCoverUrl = records
    .map((record) => readString(record.stored_cover_url))
    .find(Boolean);
  const providerCoverUrl = records
    .map((record) => readString(record.provider_cover_url))
    .find(Boolean);
  const directResultUrl = records
    .map(
      (record) =>
        readString(record.finalVideoUrl) ??
        readString(record.result_url) ??
        readString(record.resultUrl)
    )
    .find(Boolean);
  const resultUrls = dedupeStrings(
    [
      ...records.flatMap((record) => [
        ...readStringArray(record.results),
        ...readStringArray(record.resultUrls),
        ...readStringArray(record.result_urls),
        readString(record.resultUrl),
        readString(record.result_url),
        readString(record.finalVideoUrl),
      ]),
      ...creationRecords.flatMap((record) => [
        readString(record.url),
        readString(record.video_url),
        readString(record.videoUrl),
      ]),
    ]
  );
  const imageUrls = dedupeStrings(
    records.flatMap((record) => [
      ...readStringArray(record.results),
      ...readStringArray(record.image_urls),
    ])
  );
  const videoUrls = dedupeStrings(
    [
      ...records.flatMap((record) => [
        ...readStringArray(record.video_urls),
        readString(record.video_url),
        readString(asObject(record.content)?.video_url),
      ]),
      ...creationRecords.flatMap((record) => [
        readString(record.url),
        readString(record.video_url),
        readString(record.videoUrl),
      ]),
    ]
  );
  const coverUrls = dedupeStrings(
    [
      ...records.flatMap((record) => [
        ...readStringArray(record.cover_urls),
        ...readStringArray(record.coverUrls),
        readString(record.cover_url),
        readString(record.coverUrl),
        readString(record.thumbnail_url),
        readString(record.thumbnailUrl),
        readString(asObject(record.content)?.cover_url),
        readString(asObject(record.content)?.coverUrl),
      ]),
      ...creationRecords.flatMap((record) => [
        readString(record.cover_url),
        readString(record.coverUrl),
        readString(record.thumbnail_url),
        readString(record.thumbnailUrl),
      ]),
    ]
  );
  const coverUrl = storedCoverUrl ?? providerCoverUrl ?? coverUrls[0] ?? null;
  const resultUrl =
    storedResultUrl ??
    directResultUrl ??
    providerResultUrl ??
    resultUrls[0] ??
    imageUrls[0] ??
    videoUrls[0] ??
    null;

  return {
    storedResultUrl: storedResultUrl ?? null,
    providerResultUrl: providerResultUrl ?? null,
    storedCoverUrl: storedCoverUrl ?? null,
    providerCoverUrl: providerCoverUrl ?? null,
    resultUrl,
    coverUrl,
    resultUrls,
    imageUrls,
    videoUrls,
    coverUrls,
  };
};
