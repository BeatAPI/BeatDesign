import { useMemo } from 'react';

import { useTranslations } from '@/core/workspace-lib/shims/next-intl';

import type { CanvasLabels } from './beatcanvas-front-layer-context';

export function useCanvasComposerLabels(): CanvasLabels {
  const studioT = useTranslations('AppShell.studio');

  return useMemo(
    () => ({
      imageTitle: studioT('canvas.frame.imageTitle'),
      videoTitle: studioT('canvas.frame.videoTitle'),
      imageModeLabel: studioT('canvas.composer.imageMode'),
      videoModeLabel: studioT('canvas.composer.videoMode'),
      createGenerationCardLabel: studioT('canvas.connector.createGeneration'),
      createImageGenerationCardLabel: studioT(
        'canvas.connector.createImageGeneration'
      ),
      createVideoGenerationCardLabel: studioT(
        'canvas.connector.createVideoGeneration'
      ),
      connectorUploadLabel: studioT('canvas.connector.upload'),
      imagePromptPlaceholder: studioT('canvas.frame.imagePromptPlaceholder'),
      videoPromptPlaceholder: studioT('canvas.frame.videoPromptPlaceholder'),
      zoomLabel: studioT('canvas.zoom.label'),
      zoomOutLabel: studioT('canvas.zoom.zoomOut'),
      zoomInLabel: studioT('canvas.zoom.zoomIn'),
      selectToolLabel: studioT('canvas.zoom.select'),
      panToolLabel: studioT('canvas.zoom.pan'),
      fitViewLabel: studioT('canvas.zoom.fitView'),
      hideEdgesLabel: studioT('canvas.zoom.hideEdges'),
      showEdgesLabel: studioT('canvas.zoom.showEdges'),
      snapToGridLabel: studioT('canvas.zoom.snapToGrid'),
      undoLabel: studioT('canvas.zoom.undo'),
      redoLabel: studioT('canvas.zoom.redo'),
      historyLabel: studioT('canvas.shapes.history'),
      latestResultLabel: studioT('canvas.shapes.latestResult'),
      emptyStateTitle: studioT('emptyState.title'),
      emptyStateDescription: studioT('emptyState.description'),
      emptyGuideTitle: studioT('emptyState.guideTitle'),
      emptyGuideDescription: studioT('emptyState.guideDescription'),
      emptyFreeGenerateLabel: studioT('emptyState.freeGenerate'),
      emptyUploadStartLabel: studioT('emptyState.uploadStart'),
      typeLabel: studioT('canvas.composer.type'),
      modelLabel: studioT('single.labels.model'),
      parameterLabel: studioT('canvas.composer.parameters'),
      aspectRatioLabel: studioT('single.labels.aspectRatio'),
      outputQualityLabel: studioT('single.labels.outputQuality'),
      durationLabel: studioT('single.labels.duration'),
      characterOrientationLabel: studioT(
        'canvas.composer.characterOrientation'
      ),
      backgroundSourceLabel: studioT('canvas.composer.backgroundSource'),
      languageLabel: studioT('canvas.composer.language'),
      uploadImageLabel: studioT('actions.uploadImage'),
      uploadVideoLabel: studioT('actions.uploadVideo'),
      fromCanvasLabel: studioT('canvas.composer.fromCanvas'),
      currentReferencesLabel: studioT('canvas.composer.currentReferences'),
      noCanvasReferencesLabel: studioT('canvas.composer.noCanvasReferences'),
      removeReferenceLabel: studioT('canvas.composer.removeReference'),
      generateLabel: studioT('canvas.composer.generate'),
      regenerateLabel: studioT('canvas.composer.regenerate'),
      generatingLabel: studioT('canvas.composer.generating'),
      closeComposerLabel: studioT('canvas.composer.close'),
      defaultSetupLabel: studioT('canvas.composer.defaultSetup'),
      modeOptionLabel: studioT('canvas.composer.mode'),
      variantOptionLabel: studioT('canvas.composer.variant'),
      qualityOptionLabel: studioT('canvas.composer.quality'),
      tokenQualityLabel: studioT('canvas.composer.tokens.quality'),
      tokenFastLabel: studioT('canvas.composer.tokens.fast'),
      tokenLiteLabel: studioT('canvas.composer.tokens.lite'),
      tokenLowLabel: studioT('canvas.composer.tokens.low'),
      tokenMediumLabel: studioT('canvas.composer.tokens.medium'),
      tokenStandardLabel: studioT('canvas.composer.tokens.standard'),
      tokenHighLabel: studioT('canvas.composer.tokens.high'),
      tokenProLabel: studioT('canvas.composer.tokens.pro'),
      tokenAdaptiveLabel: studioT('canvas.composer.tokens.adaptive'),
      tokenAutoLabel: studioT('canvas.composer.tokens.auto'),
      tokenLandscapeLabel: studioT('canvas.composer.tokens.landscape'),
      tokenPortraitLabel: studioT('canvas.composer.tokens.portrait'),
      tokenChineseLabel: studioT('canvas.composer.tokens.chinese'),
      tokenEnglishLabel: studioT('canvas.composer.tokens.english'),
      tokenImageOrientationLabel: studioT(
        'canvas.composer.tokens.imageOrientation'
      ),
      tokenVideoOrientationLabel: studioT(
        'canvas.composer.tokens.videoOrientation'
      ),
      tokenInputImageLabel: studioT('canvas.composer.tokens.inputImage'),
      tokenInputVideoLabel: studioT('canvas.composer.tokens.inputVideo'),
      queuedStatusLabel: studioT('canvas.composer.status.queued'),
      generatingStatusLabel: studioT('canvas.composer.status.generating'),
      readyStatusLabel: studioT('canvas.composer.status.ready'),
      failedStatusLabel: studioT('canvas.composer.status.failed'),
    }),
    [studioT]
  );
}
