import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(
  new URL('./beatapi-product-home.tsx', import.meta.url),
  'utf8'
);
const routeSource = readFileSync(
  new URL('../../routes/index.tsx', import.meta.url),
  'utf8'
);
const globalStyles = readFileSync(
  new URL('../../styles/globals.css', import.meta.url),
  'utf8'
);

test('root route renders the Home surface instead of redirecting to projects', () => {
  assert.match(routeSource, /BeatApiProductHome/);
  assert.doesNotMatch(routeSource, /redirect/);
  assert.match(homeSource, /active="home"/);
  assert.match(homeSource, /href="\/projects"/);
  assert.match(homeSource, /action="\/studio"/);
});

test('hero glow stays within the responsive page gutters', () => {
  const heroGlowStyles = globalStyles.match(
    /\.beat-product-hero::before\s*\{[^}]+\}/g
  );

  assert.ok(heroGlowStyles);
  assert.match(heroGlowStyles.join('\n'), /calc\(100% \+ 2\.5rem\)/);
  assert.match(heroGlowStyles.join('\n'), /calc\(100% \+ 3rem\)/);
  assert.doesNotMatch(heroGlowStyles.join('\n'), /100vw/);
});
