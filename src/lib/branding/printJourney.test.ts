import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_JOURNEY_IDS, printJourneyAttributes, resolvePrintJourney } from './printJourney.ts';

test('only the four new themes opt into journey styling', () => {
  for (const themeId of PRINT_JOURNEY_IDS) assert.equal(resolvePrintJourney({ themeId }), themeId);
  for (const themeId of ['print-familiar','print-product','print-nordic','print-precise','print-calm','print-studio','classic','unknown']) {
    assert.deepEqual(printJourneyAttributes({ themeId }), {});
  }
  assert.deepEqual(printJourneyAttributes(null), {});
});

test('portal styles preserve authored tenant colours and all three fonts without mutating settings', () => {
  const branding = { themeId:'print-atelier', colors:{ primary:'#8B315F', secondary:'#F4E8EB', background:'#FFFBFC', card:'#FFFFFF', headingText:'#302132', bodyText:'#5B4860' }, fonts:{ heading:'Lora', body:'Manrope', pricing:'Roboto Mono' }, header:{ bgColor:'#302132', textColor:'#FFFFFF', logoFont:'Lora' }, themeSettings:{ orderFlowDesigns:{ calculator:1, checkout:4 } } };
  const before = structuredClone(branding);
  const attributes = printJourneyAttributes(branding);
  assert.equal(attributes['data-print-journey'], 'print-atelier');
  assert.equal(attributes.style?.['--journey-primary'], '#8B315F');
  assert.equal(attributes.style?.['--journey-paper'], '#FFFBFC');
  assert.equal(attributes.style?.['--journey-heading-font'], "'Lora', sans-serif");
  assert.equal(attributes.style?.['--journey-body-font'], "'Manrope', sans-serif");
  assert.equal(attributes.style?.['--journey-pricing-font'], "'Roboto Mono', monospace");
  assert.equal(attributes.style?.['--journey-header-bg'], '#302132');
  assert.deepEqual(branding, before);
});
