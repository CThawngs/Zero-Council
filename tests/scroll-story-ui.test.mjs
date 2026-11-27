import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Hero 3D stage eliminates boxed blob clipping and uses full-bleed radial ambient field', () => {
  const overview = read('web/src/prototype/components/OverviewView.tsx');
  const css = read('web/src/app/globals.css');

  // No narrow blurred .blob divs inside the hero stage
  assert.doesNotMatch(overview, /className="[^"]*\bblob\b/, 'OverviewView must not render narrow blurred .blob divs');

  // .stage must NOT clip horizontally (clipping created sharp vertical box edges)
  const stageBlock = /\.stage\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(stageBlock, '.stage CSS block must exist');
  assert.doesNotMatch(stageBlock[1], /overflow-x:\s*clip/, '.stage must not clip the 3D backdrop');

  // Full-bleed viewport ambient layer with closest-side radial gradients
  assert.match(overview, /className="ambient-field"/, 'OverviewView must render full-bleed ambient-field');
  assert.match(css, /\.ambient-field\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.ambient-field__wash--primary[\s\S]*?radial-gradient\(\s*closest-side/);
});

test('CouncilOrb counter-rotates core and advisor nodes so spheres stay round while spinning', () => {
  const orb = read('web/src/prototype/components/CouncilOrb.tsx');
  const css = read('web/src/app/globals.css');

  assert.match(orb, /council-orb__tilt/);
  assert.match(orb, /council-orb__orbit-arm/);
  assert.match(orb, /council-orb__node-anchor/);
  assert.match(orb, /pauseOffscreen/);
  assert.match(orb, /data-in-view/);

  assert.match(css, /@keyframes council-orb-counter-spin/);
  assert.match(css, /\.council-orb__core[\s\S]*?animation:\s*council-orb-counter-spin/);
  assert.match(css, /\.council-orb__node\s*\{[\s\S]*?animation:\s*council-orb-counter-spin/);
  assert.match(css, /\.council-orb\[data-in-view='false'\][\s\S]*?animation-play-state:\s*paused;/);
});

test('OverviewView preserves all landing anchors, auth/guide links, pricing handlers, and desktop sticky split-story', () => {
  const overview = read('web/src/prototype/components/OverviewView.tsx');

  // Preserved anchors
  for (const id of ['id="how-it-works"', 'id="why-zero-council"', 'id="pricing"', 'id="faq"']) {
    assert.ok(overview.includes(id), `OverviewView must preserve ${id}`);
  }

  // Preserved auth, guide, pricing, and FAQ integrations
  assert.match(overview, /href=\{authUser \? '\/dashboard' : '\/auth\?mode=signup'\}/);
  assert.match(overview, /href="\/guide"/);
  assert.match(overview, /planPrice\(plan, language\)/);
  assert.match(overview, /requestCheckout\(plan\)/);
  assert.match(overview, /cancelPlanToFree\(\)/);
  assert.match(overview, /downgradeToPro\(\)/);
  assert.match(overview, /getFaqItems\(language\)/);

  // Desktop sticky split-story (hidden on mobile <1024px) + single passive scroll listener
  assert.match(overview, /hidden lg:sticky lg:top-28 lg:block/);
  assert.match(overview, /story-chamber/);
  assert.match(overview, /addEventListener\('scroll',\s*scheduleFrame,\s*\{\s*passive:\s*true\s*\}\)/);
  assert.match(overview, /requestAnimationFrame/);

  // Mobile float-card safeguards preserved
  assert.match(overview, /grid-cols-1 gap-2\.5 sm:mt-0 sm:block/);
  assert.match(overview, /float-card[\s\S]*?min-w-0 max-w-full/);
});

test('Reduced-motion and mobile fallbacks disable parallax/ambient shifts and expose all content', () => {
  const css = read('web/src/app/globals.css');
  const reveal = read('web/src/prototype/components/Reveal.tsx');

  const rmIdx = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(rmIdx !== -1, 'prefers-reduced-motion media query must exist');
  const rmBlock = css.slice(rmIdx);

  assert.match(rmBlock, /\.reveal\[data-armed='true'\][\s\S]*?opacity:\s*1\s*!important;/);
  assert.match(rmBlock, /\.hero-orb-rig[\s\S]*?transform:\s*none\s*!important;/);
  assert.match(rmBlock, /\.ambient-field__wash[\s\S]*?transform:\s*none\s*!important;/);
  assert.match(rmBlock, /\.council-orb__scene[\s\S]*?animation:\s*none\s*!important;/);
  assert.match(rmBlock, /\.council-orb__core,\s*\.council-orb__node[\s\S]*?animation:\s*none\s*!important;/);

  // Mobile (<1024px) hides 3rd ambient wash and disables transitions
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*?\.ambient-field__wash--accent\s*\{[\s\S]*?display:\s*none;/);

  // Additive reveal respects prefers-reduced-motion
  assert.match(reveal, /prefers-reduced-motion: reduce/);
});

test('Story root avoids Tailwind space-y margin on fixed ambient/progress children', () => {
  const overview = read('web/src/prototype/components/OverviewView.tsx');
  const css = read('web/src/app/globals.css');

  const rootClassMatch = /className="([^"]*zc-story-root[^"]*)"/.exec(overview);
  assert.ok(rootClassMatch, '.zc-story-root element must exist');
  const rootClasses = rootClassMatch[1];

  assert.doesNotMatch(
    rootClasses,
    /(?:^|\s)(?:sm:|md:|lg:|xl:)?space-y-/,
    '.zc-story-root must not use space-y-* utilities that add margin-bottom to fixed children'
  );
  assert.match(rootClasses, /\bflex\b/);
  assert.match(rootClasses, /\bflex-col\b/);
  assert.match(rootClasses, /\bgap-24\b/);
  assert.match(rootClasses, /\bsm:gap-28\b/);
  assert.match(rootClasses, /\blg:gap-32\b/);

  const ambientBlock = /\.ambient-field\s*\{([\s\S]*?)\r?\n\}/.exec(css);
  assert.ok(ambientBlock, '.ambient-field CSS block must exist');
  assert.match(ambientBlock[1], /margin:\s*0;/, '.ambient-field must explicitly reset margin: 0');

  const progressBlock = /\.story-progress-track\s*\{([\s\S]*?)\r?\n\}/.exec(css);
  assert.ok(progressBlock, '.story-progress-track CSS block must exist');
  assert.match(progressBlock[1], /margin:\s*0;/, '.story-progress-track must explicitly reset margin: 0');
});

test('Step switcher buttons scroll target step into view unless reduced-motion is active', () => {
  const overview = read('web/src/prototype/components/OverviewView.tsx');

  assert.match(overview, /const handleStepSelect = useCallback\(\(index: number\) => \{/);
  assert.match(
    overview,
    /handleStepSelect[\s\S]*?setActiveStep\(index\);[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?stepNodeRefs\.current\[index\]\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'center'\s*\}\)/
  );
  assert.match(overview, /onClick=\{\(\) => handleStepSelect\(idx\)\}/);
});
