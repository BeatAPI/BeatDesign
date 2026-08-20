'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderValue {
  id: string;
  preview: string;
  url?: string;
  status: UploadStatus;
  size?: number;
}

interface ImageUploaderProps {
  allowMultiple?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  title?: string;
  emptyHint?: string;
  className?: string;
  defaultPreviews?: string[];
  onChange?: (items: ImageUploaderValue[]) => void;
}

interface UploadItem extends ImageUploaderValue {
  file?: File;
  uploadKey?: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const uploadImageFile = async (file: File) => {
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch('/api/storage/upload-image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  const result = await response.json();
  if (result.code !== 0 || !result.data?.urls?.length) {
    throw new Error(result.message || '');
  }

  return result.data.urls[0] as string;
};

export function ImageUploader({
  allowMultiple = false,
  maxImages = 1,
  maxSizeMB = 10,
  title,
  emptyHint,
  className,
  defaultPreviews,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const isInternalChangeRef = useRef(false);
  const replaceTargetIdRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const [items, setItems] = useState<UploadItem[]>(() => {
    if (defaultPreviews?.length) {
      return defaultPreviews.map((url, index) => ({
        id: `preset-${url}-${index}`,
        preview: url,
        url,
        status: 'uploaded' as UploadStatus,
      }));
    }
    return [];
  });

  const maxCount = allowMultiple ? maxImages : 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const defaultUrls = defaultPreviews || [];

    setItems((currentItems) => {
      const currentUrls = currentItems
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      const isSame =
        defaultUrls.length === currentUrls.length &&
        defaultUrls.every((url, index) => url === currentUrls[index]);

      if (!isSame) {
        return defaultUrls.map((url, index) => ({
          id: `preset-${url}-${index}`,
          preview: url,
          url,
          status: 'uploaded' as UploadStatus,
        }));
      }

      return currentItems;
    });
  }, [defaultPreviews]);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [items]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    isInternalChangeRef.current = true;

    onChangeRef.current?.(
      items.map(({ id, preview, url, status, size }) => ({
        id,
        preview,
        url,
        status,
        size,
      })),
    );
  }, [items]);

  const replaceItems = (pairs: Array<{ id: string; file: File }>) => {
    pairs.forEach(({ id, file }) => {
      const uploadKey = `${Date.now()}-${Math.random()}`;
      const nextPreview = URL.createObjectURL(file);

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          if (item.preview.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
          }
          return {
            ...item,
            preview: nextPreview,
            file,
            size: file.size,
            url: undefined,
            status: 'uploading' as UploadStatus,
            uploadKey,
          };
        }),
      );

      uploadImageFile(file)
        .then((url) => {
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              if (item.uploadKey !== uploadKey) return item;
              if (item.preview.startsWith('blob:')) {
                URL.revokeObjectURL(item.preview);
              }
              return {
                ...item,
                preview: url,
                url,
                status: 'uploaded' as UploadStatus,
                file: undefined,
              };
            }),
          );
        })
        .catch((error: any) => {
          console.error('Upload failed:', error);
          toast.error(
            error?.message
              ? m['common.upload.upload_failed_with_message']({
                  message: error.message,
                })
              : m['common.upload.upload_failed']()
          );
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              if (item.uploadKey !== uploadKey) return item;
              return { ...item, status: 'error' as UploadStatus };
            }),
          );
        })
        .finally(() => {
          if (inputRef.current) inputRef.current.value = '';
        });
    });
  };

  const handleFiles = (selectedFiles: File[]) => {
    const replaceTargetId = replaceTargetIdRef.current;
    if (replaceTargetId) {
      replaceTargetIdRef.current = null;
      const file = selectedFiles[0];
      if (!file) return;
      if (!file.type?.startsWith('image/')) {
        toast.error(m['common.upload.only_images_supported']());
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      if (file.size > maxBytes) {
        toast.error(
          m['common.upload.file_too_large']({
            file: file.name,
            maxSizeMB,
          })
        );
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      replaceItems([{ id: replaceTargetId, file }]);
      return;
    }

    const availableSlots = maxCount - items.length;
    const filesToAdd = selectedFiles
      .filter((file) => {
        if (!file.type?.startsWith('image/')) {
          toast.error(m['common.upload.file_not_image']({ file: file.name }));
          return false;
        }
        if (file.size > maxBytes) {
          toast.error(
            m['common.upload.file_too_large']({
              file: file.name,
              maxSizeMB,
            })
          );
          return false;
        }
        return true;
      })
      .slice(0, Math.max(availableSlots, 0));

    if (!filesToAdd.length) {
      if (items.length) {
        const normalized = selectedFiles.filter((file) => file.type?.startsWith('image/'));
        if (!normalized.length) return;

        const k = Math.min(normalized.length, items.length);
        const tail = items.slice(-k);
        const pairs: Array<{ id: string; file: File }> = [];

        for (let i = 0; i < k; i += 1) {
          const targetId = tail[tail.length - 1 - i]?.id;
          const file = normalized[i];
          if (targetId && file) pairs.push({ id: targetId, file });
        }

        if (pairs.length) replaceItems(pairs);
      }

      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (availableSlots < selectedFiles.length) {
      toast.message(
        m['common.upload.only_first_images_added']({
          count: filesToAdd.length,
        })
      );
    }

    const newItems = filesToAdd.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      preview: URL.createObjectURL(file),
      file,
      size: file.size,
      status: 'uploading' as UploadStatus,
      uploadKey: `${Date.now()}-${Math.random()}`,
    }));

    setItems((prev) => [...prev, ...newItems]);

    Promise.all(
      newItems.map(async (item) => {
        try {
          const url = await uploadImageFile(item.file as File);
          setItems((prev) =>
            prev.map((current) => {
              if (current.id !== item.id) return current;
              if (current.uploadKey && item.uploadKey && current.uploadKey !== item.uploadKey) {
                return current;
              }
              if (current.preview.startsWith('blob:')) {
                URL.revokeObjectURL(current.preview);
              }
              return {
                ...current,
                preview: url,
                url,
                status: 'uploaded' as UploadStatus,
                file: undefined,
              };
            }),
          );
        } catch (error: any) {
          console.error('Upload failed:', error);
          toast.error(
            error?.message
              ? m['common.upload.upload_failed_with_message']({
                  message: error.message,
                })
              : m['common.upload.upload_failed']()
          );
          setItems((prev) =>
            prev.map((current) => {
              if (current.id !== item.id) return current;
              if (current.uploadKey && current.uploadKey !== item.uploadKey) return current;
              return { ...current, status: 'error' as UploadStatus };
            }),
          );
        }
      }),
    );

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    handleFiles(selectedFiles);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const files = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[];

    if (!files.length) return;
    event.preventDefault();
    handleFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
      file.type?.startsWith('image/'),
    );
    if (!files.length) return;
    handleFiles(files);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const openReplacePicker = (id: string) => {
    replaceTargetIdRef.current = id;
    openFilePicker();
  };

  const countLabel = useMemo(() => `${items.length}/${maxCount}`, [items.length, maxCount]);

  return (
    <div
      className={cn(
        'relative focus:outline-none',
        isDragActive && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
        className,
      )}
      tabIndex={0}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="rounded-full bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
            {m['common.upload.drop_to_upload']()}
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
        multiple={allowMultiple}
        onChange={handleSelect}
        className="hidden"
      />

      {title && (
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <span>{title}</span>
            <span className="text-xs text-primary">({countLabel})</span>
          </div>
        </div>
      )}

      <div className={cn('flex flex-wrap gap-4', allowMultiple ? 'flex-wrap' : 'flex-nowrap')}>
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-xl border border-border bg-muted/50 p-1 shadow-sm transition hover:border-border hover:bg-muted"
          >
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={item.preview}
                alt={m['common.upload.preview']()}
                className="h-32 w-32 rounded-lg object-cover"
              />
              {item.size && (
                <span className="absolute bottom-2 left-2 rounded-md bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {formatBytes(item.size)}
                </span>
              )}
              {item.status !== 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full bg-background/50 text-foreground shadow-sm backdrop-blur hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-white/70"
                    onClick={() => openReplacePicker(item.id)}
                    aria-label={m['common.upload.replace_image']()}
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                </div>
              )}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                  {m['common.upload.uploading']()}
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white">
                  {m['common.upload.failed']()}
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-2 top-2 z-20 h-7 w-7"
                onClick={() => handleRemove(item.id)}
                aria-label={m['common.upload.remove_image']()}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {items.length < maxCount && (
          <div className="group relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/50 p-1 shadow-sm transition hover:border-border hover:bg-muted">
            <div className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                className="flex h-32 w-32 flex-col items-center justify-center gap-2"
                onClick={openFilePicker}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">
                  {m['common.upload.upload']()}
                </span>
                <span className="text-xs text-primary">
                  {m['common.upload.max_size']({ maxSizeMB })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!title && emptyHint && (
        <div className="mt-2 text-xs text-muted-foreground">{emptyHint}</div>
      )}
    </div>
  );
}
