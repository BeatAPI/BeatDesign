import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * In-product replacement for window.confirm — renders on the shadcn Dialog
 * primitive with two surface variants: `default` for light utility
 * dashboard, `beat` for the BeatAPI dark product skin.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  variant = 'default',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  variant?: 'default' | 'beat';
}) {
  async function handleConfirm() {
    await onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={
          variant === 'beat'
            ? 'rounded-[22px] border border-white/10 bg-[#111214] p-6 text-[#f6f6f4] ring-0 shadow-[0_34px_110px_rgba(0,0,0,0.62)] sm:max-w-[420px] [&_[data-slot=dialog-close]]:text-white/45'
            : 'sm:max-w-[420px]'
        }
      >
        <DialogHeader>
          <DialogTitle
            className={
              variant === 'beat'
                ? 'beat-product-display text-[17px] font-semibold tracking-[-0.02em] text-white'
                : 'text-[15px] font-semibold text-foreground'
            }
          >
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription
              className={
                variant === 'beat'
                  ? 'text-[13px] leading-6 text-white/48'
                  : 'text-[13px] leading-6'
              }
            >
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFooter
          className={
            variant === 'beat'
              ? 'mt-1 flex-row justify-end gap-2 rounded-none border-0 bg-transparent p-0'
              : 'mt-1'
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className={
              variant === 'beat'
                ? 'h-10 rounded-[var(--beat-radius-sm)] border-white/12 bg-transparent px-4 text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white'
                : 'h-10 px-4'
            }
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void handleConfirm()}
            className={cn(
              'h-10 px-4 text-[13px] font-semibold',
              variant === 'beat' &&
                'rounded-[var(--beat-radius-sm)] bg-red-500 text-white shadow-[0_10px_28px_rgba(239,68,68,0.28)] hover:bg-red-600'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              </>
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
