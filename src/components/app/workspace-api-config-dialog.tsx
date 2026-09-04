import { Cloud, Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DEFAULT_BEATAPI_BASE_URL,
  getBeatCanvasProviderPublicConfig,
} from '@/core/beatcanvas/providers/provider-config';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { apiGet, apiPost } from '@/lib/api-client';
import { maskApiKeyPreview } from '@/lib/mask-api-key';

/** Custom plug glyph — the workspace's "connect your API" mark. */
function PlugGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 2.5v4.5" />
      <path d="M15 2.5v4.5" />
      <path d="M6.5 7h11v3.8a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 16.3v2.2" />
      <path d="M12 18.5c0 1.6 1.4 3 3 3h2.5" />
    </svg>
  );
}

const inputClassName =
  'h-11 w-full rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3.5 font-mono text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#ff7a33]/55 focus:ring-[3px] focus:ring-[#ff7a33]/15';

const saveButtonClassName =
  'h-11 w-full rounded-[12px] bg-[#ff7a33] text-[14px] font-semibold text-[#1d1d1f] shadow-[0_8px_24px_rgba(255,122,51,0.24)] transition hover:bg-[#ff8a4d] disabled:cursor-not-allowed disabled:opacity-60';

type BeatApiConfigState = {
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
};

type StorageConfigState = {
  mode: 'beatapi' | 's3';
  managedEligible: boolean;
  custom: {
    region: string;
    endpoint: string;
    bucketName: string;
    publicUrl: string;
    forcePathStyle: boolean;
    accessKeyConfigured: boolean;
    secretKeyConfigured: boolean;
  };
};

function ApiConfigForm({
  providerLabel,
  isDefault,
  state,
  loaded,
  onSaved,
}: {
  providerLabel: string;
  isDefault: boolean;
  state: BeatApiConfigState | null;
  loaded: boolean;
  onSaved: (state: BeatApiConfigState) => void;
}) {
  const t = useTranslations('AppShell.header.apiConfig');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const configured = Boolean(state?.apiKeyConfigured && state.apiKeyPreview);
  const showEditor = loaded && (!configured || replacing);

  async function save() {
    const nextKey = apiKey.trim();
    if (!nextKey) return;
    setSaving(true);
    try {
      const result = await apiPost<{ apiKeyPreview?: string }>(
        '/api/config/beatapi',
        { apiKey: nextKey }
      );
      toast.success(t('saved'));
      setApiKey('');
      setReplacing(false);
      onSaved({
        baseUrl: DEFAULT_BEATAPI_BASE_URL,
        apiKeyConfigured: true,
        apiKeyPreview: result?.apiKeyPreview || maskApiKeyPreview(nextKey),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium text-white">{providerLabel}</p>
        {isDefault ? (
          <span className="rounded-full border border-[#ff7a33]/30 bg-[#ff7a33]/10 px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-[#ff9a62]">
            {t('defaultBadge')}
          </span>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="beatapi-key"
            className="text-[12px] font-medium text-white/45"
          >
            {t('keyLabel')}
          </label>
          {configured && !replacing ? (
            <span className="rounded-full border border-[#ff7a33]/30 bg-[#ff7a33]/10 px-2 py-0.5 text-[11px] font-medium text-[#ff9a62]">
              {t('keyConfigured')}
            </span>
          ) : null}
        </div>

        {!loaded ? (
          <div
            className="h-11 animate-pulse rounded-[12px] border border-white/[0.08] bg-white/[0.04] motion-reduce:animate-none"
            aria-label={t('loadingConnection')}
          />
        ) : showEditor ? (
          <input
            id="beatapi-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t('keyPlaceholder')}
            autoComplete="off"
            className={inputClassName}
          />
        ) : (
          <div className="flex h-11 items-center rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3.5 font-mono text-[13px] text-white/80">
            {state?.apiKeyPreview}
          </div>
        )}

        <p className="mt-2 text-[12px] leading-5 text-white/40">
          {t('connectHint')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {configured && !replacing ? (
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="text-[13px] font-semibold text-white/55 transition hover:text-white"
            >
              {t('replaceKey')}
            </button>
          ) : null}
          {replacing ? (
            <button
              type="button"
              onClick={() => {
                setReplacing(false);
                setApiKey('');
              }}
              className="text-[13px] font-semibold text-white/55 transition hover:text-white"
            >
              {t('cancelReplace')}
            </button>
          ) : null}
          <a
            href="https://beatapi.io/dashboard/apikeys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-[13px] font-semibold text-[#ff8b4d] transition hover:text-[#ffa26b]"
          >
            {t('getKey')}
          </a>
        </div>
      </div>

      {showEditor ? (
        <button
          type="button"
          disabled={saving || !apiKey.trim()}
          onClick={() => void save()}
          className={saveButtonClassName}
        >
          {saving ? t('saving') : t('save')}
        </button>
      ) : null}
    </div>
  );
}

function StorageConfigForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations('AppShell.header.apiConfig.storage');
  const [state, setState] = useState<StorageConfigState | null>(null);
  const [mode, setMode] = useState<'beatapi' | 's3'>('beatapi');
  const [region, setRegion] = useState('auto');
  const [endpoint, setEndpoint] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [forcePathStyle, setForcePathStyle] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiGet<StorageConfigState>('/api/config/storage')
      .then((config) => {
        if (cancelled || !config) return;
        setState(config);
        setMode(config.mode);
        setRegion(config.custom.region || 'auto');
        setEndpoint(config.custom.endpoint);
        setBucketName(config.custom.bucketName);
        setPublicUrl(config.custom.publicUrl);
        setForcePathStyle(config.custom.forcePathStyle);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await apiPost('/api/config/storage', {
        mode,
        ...(mode === 's3'
          ? {
              region: region.trim() || 'auto',
              endpoint: endpoint.trim(),
              bucketName: bucketName.trim(),
              publicUrl: publicUrl.trim(),
              accessKeyId: accessKeyId.trim(),
              secretAccessKey: secretAccessKey.trim(),
              forcePathStyle,
            }
          : {}),
      });
      toast.success(t('saved'));
      setState((previous) =>
        previous
          ? {
              mode,
              managedEligible: previous.managedEligible,
              custom: {
                ...previous.custom,
                region,
                endpoint,
                bucketName,
                publicUrl,
                forcePathStyle,
                accessKeyConfigured: Boolean(
                  accessKeyId || previous.custom.accessKeyConfigured
                ),
                secretKeyConfigured: Boolean(
                  secretAccessKey || previous.custom.secretKeyConfigured
                ),
              },
            }
          : previous
      );
      setAccessKeyId('');
      setSecretAccessKey('');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <div className="grid grid-cols-2 gap-1 rounded-[12px] border border-white/[0.08] bg-black/20 p-1">
        <button
          type="button"
          disabled={!state?.managedEligible}
          onClick={() => {
            if (state?.managedEligible) setMode('beatapi');
          }}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold transition ${
            mode === 'beatapi'
              ? 'bg-white/[0.08] text-white'
              : 'text-white/40 hover:text-white/70'
          } disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-white/40`}
        >
          <Cloud
            className={`size-3.5 ${mode === 'beatapi' ? 'text-[#ff8b4d]' : ''}`}
          />
          {t('managedTitle')}
        </button>
        <button
          type="button"
          onClick={() => setMode('s3')}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold transition ${
            mode === 's3'
              ? 'bg-white/[0.08] text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Database
            className={`size-3.5 ${mode === 's3' ? 'text-[#ff8b4d]' : ''}`}
          />
          {t('customTitle')}
        </button>
      </div>

      {mode === 'beatapi' ? (
        <p className="text-[12px] leading-5 text-white/40">{t('managedHint')}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder={t('regionPlaceholder')}
              aria-label={t('regionLabel')}
              className={inputClassName}
            />
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder={t('endpointPlaceholder')}
              aria-label={t('endpointLabel')}
              className={inputClassName}
            />
          </div>
          <input
            value={bucketName}
            onChange={(event) => setBucketName(event.target.value)}
            placeholder={t('bucketPlaceholder')}
            aria-label={t('bucketLabel')}
            className={inputClassName}
          />
          <input
            value={publicUrl}
            onChange={(event) => setPublicUrl(event.target.value)}
            placeholder={t('publicUrlPlaceholder')}
            aria-label={t('publicUrlLabel')}
            className={inputClassName}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="password"
              value={accessKeyId}
              onChange={(event) => setAccessKeyId(event.target.value)}
              placeholder={
                state?.custom?.accessKeyConfigured
                  ? t('configuredPlaceholder')
                  : t('accessKeyPlaceholder')
              }
              aria-label={t('accessKeyLabel')}
              autoComplete="off"
              className={inputClassName}
            />
            <input
              type="password"
              value={secretAccessKey}
              onChange={(event) => setSecretAccessKey(event.target.value)}
              placeholder={
                state?.custom?.secretKeyConfigured
                  ? t('configuredPlaceholder')
                  : t('secretKeyPlaceholder')
              }
              aria-label={t('secretKeyLabel')}
              autoComplete="off"
              className={inputClassName}
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-white/45">
            <input
              type="checkbox"
              checked={forcePathStyle}
              onChange={(event) => setForcePathStyle(event.target.checked)}
              className="accent-[#ff7a33]"
            />
            {t('forcePathStyle')}
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className={saveButtonClassName}
      >
        {saving ? t('saving') : t('save')}
      </button>
    </div>
  );
}

export function WorkspaceApiConfigDialog({
  providerId,
}: {
  providerId?: string | null;
}) {
  const t = useTranslations('AppShell.header.apiConfig');
  const provider = getBeatCanvasProviderPublicConfig(providerId);
  const [saveSignal, setSaveSignal] = useState(0);
  const [section, setSection] = useState<'provider' | 'storage'>('provider');
  const [providerState, setProviderState] =
    useState<BeatApiConfigState | null>(null);
  const [providerStateLoaded, setProviderStateLoaded] = useState(false);
  const providerConfigured = Boolean(
    providerState?.apiKeyConfigured && providerState.apiKeyPreview
  );

  useEffect(() => {
    let cancelled = false;
    void apiGet<BeatApiConfigState>('/api/config/beatapi')
      .then((config) => {
        if (!cancelled) setProviderState(config);
      })
      .catch(() => {
        if (!cancelled) setProviderState(null);
      })
      .finally(() => {
        if (!cancelled) setProviderStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog>
      <DialogTrigger
        aria-label={
          providerConfigured ? t('triggerConfiguredLabel') : t('triggerLabel')
        }
        title={
          providerConfigured ? t('triggerConfiguredLabel') : t('triggerLabel')
        }
        className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-white/[0.035] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a33]/45 ${
          providerConfigured
            ? 'border-[#ff7a33]/35 text-[#ff8b4d]'
            : 'border-white/[0.09] text-[#a0a1a8] hover:border-white/[0.18]'
        }`}
      >
        <PlugGlyph className="size-[18px]" />
        {providerConfigured ? (
          <span
            className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-[#111214] bg-[#c7f36b]"
            aria-hidden="true"
          />
        ) : null}
      </DialogTrigger>

      <DialogContent className="beat-product-shell max-h-[88vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#111214] p-0 text-[#f5f5f7] shadow-[0_34px_110px_rgba(0,0,0,0.62)] ring-0 sm:max-w-[480px] [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:text-white/45 [&_[data-slot=dialog-close]]:hover:bg-white/[0.07] [&_[data-slot=dialog-close]]:hover:text-white">
        <div className="border-b border-white/[0.08] px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[12px] border border-[#ff7a33]/25 bg-[#ff7a33]/10 text-[#ff8b4d]">
              <PlugGlyph className="size-4" />
            </span>
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="beat-product-display text-[17px] font-semibold tracking-[-0.02em] text-white">
                {t('title')}
              </DialogTitle>
              <DialogDescription className="text-[12px] leading-5 text-white/45">
                {section === 'provider' ? t('description') : t('storage.intro')}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-white/[0.08] bg-black/10 p-1">
          {(['provider', 'storage'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              className={`h-9 rounded-[10px] text-[13px] font-semibold transition ${
                section === item
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {item === 'provider' ? t('providerTab') : t('storageTab')}
            </button>
          ))}
        </div>

        {section === 'provider' ? (
          <ApiConfigForm
            key={`provider-${saveSignal}`}
            providerLabel={provider.label}
            isDefault={provider.isDefault}
            state={providerState}
            loaded={providerStateLoaded}
            onSaved={(nextState) => {
              setProviderState(nextState);
              setProviderStateLoaded(true);
              setSaveSignal((n) => n + 1);
            }}
          />
        ) : (
          <StorageConfigForm
            key={`storage-${saveSignal}`}
            onSaved={() => setSaveSignal((n) => n + 1)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
