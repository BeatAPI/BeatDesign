# Design System — BeatAPI SaaS Template

## Product Context

- **What this is:** An open-source AI SaaS starter and a working demonstration of building on BeatAPI.
- **Who it is for:** Independent developers and small product teams shipping AI media products for an international audience.
- **Space:** Developer tools, AI creative software, and SaaS infrastructure.
- **Project type:** Marketing site, authenticated SaaS dashboard, guided studio, and node canvas.

## Aesthetic Direction

- **Direction:** Warm technical editorial in marketing; cinematic black creative operating system across Studio, Canvas, and PromptWise-structured Pricing.
- **Decoration:** Intentional. Typography, product media, fine grid lines, dark glass controls, and restrained highlights create character without ornamental UI noise.
- **Layout:** Hybrid. Marketing uses editorial scale and asymmetry; authenticated product surfaces use a strict, predictable grid.
- **Mood:** Capable, cinematic, and crafted. Creation surfaces should feel like focused production tools, while the marketing site stays warmer and more editorial.
- **Reference language:** PromptWise is the visual reference, not a copied page or a separately selectable theme.

## Typography

- **Display, body, and UI:** Figtree Variable. Its open shapes keep large statements expressive and dense product UI readable.
- **Data and code:** Geist Mono with tabular numerals.
- **CJK fallback:** `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, system sans-serif.
- **Loading:** Self-host fonts in the released repository; external font loading is allowed only in the design preview.
- **Scale:** 12, 14, 16, 18, 24, 32, 48, 72, and responsive 96px display. Body line-height is 1.55; display line-height is 0.94–1.05.

## Color

- **Approach:** Restrained. Orange is the sole brand action color; semantic colors do not compete with it.
- **Brand 500:** `#FF6B1A` — primary actions, active controls, focus emphasis.
- **Brand 600:** `#E9550B` — hover and pressed states.
- **Brand soft:** `#FFF0E5` — selected surfaces and subtle callouts.
- **Marketing canvas:** `#F6F0E7` — warm cream.
- **Studio / Canvas canvas:** `#08090A` — near-black production workspace.
- **Pricing canvas:** `#08090A` with graphite `#141517` plan cards, warm-white type, and PromptWise's original plan geometry.
- **Dark surface:** `#111214`; raised surface `#17181B`; control surface `#202126`.
- **Dark ink:** `#F6F6F4`; secondary `rgba(246,246,244,.58)`; faint `rgba(246,246,244,.34)`.
- **Surface:** `#FFFFFF`; raised surface `#FCFCFA`.
- **Ink:** `#171814`; secondary `#5F625B`; faint `#8E9188`.
- **Borders:** `#DDDED8`; strong `#C7C9C0`.
- **Highlight:** `#C7F36B` — sparse proof or status accent, never a primary CTA.
- **Success:** `#208A55`; warning `#B66A09`; error `#C23B32`; info `#2563A9`.
- **Dark product surfaces:** Near-black canvas with charcoal cards. Orange stays saturated because it is the only brand action color; purple is limited to Canvas graph semantics. Pricing keeps PromptWise's commercial hierarchy while using the same dark product vocabulary as Studio and Canvas.

## Spacing and Shape

- **Base unit:** 4px.
- **Scale:** 2xs 2, xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32, 3xl 48, 4xl 64, 5xl 96.
- **Density:** Spacious in marketing, comfortable in dashboard, compact only in canvas toolbars and tables.
- **Radius:** 4px controls, 8px inputs/small cards, 12px panels, 16px media, pill only for tags and segmented controls.
- **Borders:** One-pixel neutral borders carry most hierarchy. Shadows are reserved for floating canvas controls, dialogs, and menus.

## Layout

- **Marketing grid:** 12 columns, max width 1280px, 24–32px gutters.
- **App grid:** Creative project routes use a 56px top bar and fluid main region without a persistent sidebar. Administrative routes may keep their own navigation.
- **Studio:** No sidebar. A full-bleed media wall supports a bottom floating composer; media type, model, ratio, credits, and Generate live in that composer. Content max width is 1380px and composer max width is 1180px.
- **Canvas:** Full-bleed workspace inside the same AppShell. Floating toolbars use the shared panel tokens.
- **Responsive:** Sidebar becomes a drawer below 960px. Canvas remains usable with touch-safe controls and a collapsible inspector.

## Component Language

### Foundation

Button, IconButton, Input, Textarea, Select, Checkbox, Switch, Tabs, Tooltip, Dialog, Drawer, Card, Table, Badge, Skeleton, Toast, and Progress.

### Marketing

MarketingHeader, HeroStatement, HeroDemoFrame, ProofStrip, FeatureStory, MediaShowcase, WorkflowSteps, CodePreview, PricingSection, FAQ, CTA, and MarketingFooter.

### Product

AppShell, AppSidebar, AppTopbar, PageHeader, MetricCard, DataTable, EmptyState, ErrorState, LoadingState, UsageMeter, CreditBalance, and StatusBadge.

### Creative workspace

WorkspaceSwitcher, PromptComposer, MediaUploader, ModelPicker, EffectPicker, GenerationSettings, GenerationCard, TaskProgress, ResultViewer, CreditEstimate, APIRequestPreview, WebhookStatus, CanvasNode, CanvasEdge, CanvasToolbar, and InspectorPanel.

Do not create a universal `Section` component controlled by many presentation props. Reuse small primitives and keep each product section semantically owned.

## Canvas Rules

React Flow remains the interaction engine. PromptWise changes its visual expression, not its graph behavior.

- Canvas background uses the same near-black canvas with a restrained two-scale dot grid.
- Nodes are dark, thin-bordered cards with a narrow semantic header and clear input/output ports.
- Purple marks graph selection and connection semantics; orange remains reserved for brand and purchase actions.
- Toolbars and inspectors match AppShell surfaces, typography, radius, and focus states.
- Zoom, pan, connect, multi-select, keyboard shortcuts, undo/redo, persistence, and accessibility behavior are regression-tested independently of styling.

## Motion

- **Approach:** Intentional and functional.
- **Durations:** micro 80ms, short 160ms, medium 260ms, long 480ms.
- **Easing:** enter `cubic-bezier(.22,1,.36,1)`; exit `cubic-bezier(.4,0,1,1)`; move `cubic-bezier(.4,0,.2,1)`.
- Marketing may use line reveals and media transitions. Product motion explains state changes. Canvas movement must remain direct and never feel delayed.
- Respect `prefers-reduced-motion` everywhere.

## Content Hierarchy

Homepage emphasis is approximately 70% what can be built with BeatAPI, 20% what the starter includes, and 10% open-source/GitHub proof.

- Primary CTA: **Get a BeatAPI key**.
- Secondary CTA: **View on GitHub**.
- Tertiary CTA: **Explore the demo**.

## Accessibility

- WCAG AA contrast for text and interactive states.
- Visible keyboard focus using the brand ring plus neutral offset.
- Minimum 44px touch targets where space permits.
- Never encode task status with color alone.
- All canvas controls have names, keyboard equivalents, and reduced-motion behavior.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-12 | One PromptWise-derived design language | A single recognizable system is more valuable than several shallow themes. |
| 2026-08-12 | Shared AppShell with Studio and Canvas modes | Preserves both workflows without doubling dashboard maintenance. |
| 2026-08-12 | Orange primary, cream marketing, neutral app | Connects the brand across marketing and product while preserving workspace clarity. |
| 2026-08-12 | Figtree + Geist Mono | Keeps creative brand expression and developer readability in one family of interfaces. |
| 2026-08-15 | Unified black Studio, Canvas, and Pricing | Pricing retains the preferred PromptWise structure while matching the cinematic product environment. |
| 2026-08-15 | Studio has no sidebar | The media wall and composer are the product; permanent navigation would dilute focus and reduce working width. |
| 2026-08-15 | Independent PromptWise-style pricing route | Pricing is linkable, uses the source card geometry directly, and preserves BeatAPI checkout behavior. |
| 2026-08-18 | Studio/Canvas composers unified on the beat token system | Both composers share one vocabulary (`@/components/app/composer-styles.ts`): the homepage hero card recipe, `--beat-*` tokens, and one orange Generate action. `--beat-studio-*` became aliases; `--beatcanvas-*` surface/ink tokens map onto the beat neutral scale. |
| 2026-08-18 | Canvas graph semantics moved from purple to cold blue (`--beat-graph` #7fb0f2) | The old VisuGen purple is retired. Cold blue selection/edges/minimap echoes the Start Here thumbnails the product opens with, and keeps "selected" visually distinct from the orange action color. |
| 2026-08-18 | Start Here empty state is the protected quality bar | The four cold-blue thumbnails + "Create Here" stay untouched; dark product surfaces are tuned around them. |
