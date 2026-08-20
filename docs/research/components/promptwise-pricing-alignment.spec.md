# PromptWise Pricing Alignment Specification

## Overview

- Target: `src/components/pricing/pricing-credit-pack-grid.tsx`
- Reference screenshot: local research capture, intentionally excluded from the public repository.
- Reference source: PromptWise public pricing page, captured during the 2026-08-20 pricing review.
- Interaction: responsive carousel/grid plus existing checkout actions.

## Source Geometry

- Billing toggle: rounded-full surface with 4px padding; active item uses inverse surface.
- Card wrapper: 36px top padding for the savings ribbon.
- Ribbon: absolute, 64px high, 30px top radius, centered 13px uppercase copy.
- Card body: 38px radius, 24px padding, 20px vertical content gap.
- Plan title: 2em, semibold; desktop 2.5em.
- Price: 46px desktop with a struck previous price.
- Credit panel: minimum 220px high, 24px radius, nested surface.
- CTA: minimum 48px high, full-width pill with a 56px by 40px leading icon capsule.
- Features: 15px type, 24px line height, 10px icon gap.

## Adaptation

- Preserve PromptWise's geometry, spacing, ribbon hierarchy, nested credit panels, and pill CTAs; adapt the palette to BeatAPI's near-black canvas, graphite cards, warm-white type, and orange action accent.
- Map the existing Free plus three one-time BeatAPI packages into the four-card layout without changing payment behavior.

## Responsive

- Desktop: four equal columns.
- Tablet: two columns.
- Mobile: horizontal snap cards with carousel-like overflow.
