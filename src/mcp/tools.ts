export const BEATDESIGN_MCP_TOOL_NAMES = [
  'bdesign_project_list',
  'bdesign_project_get',
  'bdesign_project_create',
  'bdesign_asset_list',
  'bdesign_asset_get',
  'bdesign_asset_import',
  'bdesign_canvas_get',
  'bdesign_canvas_search',
  'bdesign_canvas_apply',
  'bdesign_generation_models',
  'bdesign_generation_model_get',
  'bdesign_generation_submit',
  'bdesign_generation_status',
  'bdesign_generation_history',
  'bdesign_editor_get',
  'bdesign_editor_edit',
  'bdesign_editor_snapshot',
  'bdesign_editor_diagnostics',
  'bdesign_editor_view',
  'bdesign_editor_history',
] as const;

export type BeatDesignMcpToolName = (typeof BEATDESIGN_MCP_TOOL_NAMES)[number];
