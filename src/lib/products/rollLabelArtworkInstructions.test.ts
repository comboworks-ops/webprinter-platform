import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rollLabelArtworkForState} from './rollLabelArtworkInstructions.ts';
import type {RollLabelReviewProfile} from './rollLabelReview';
const base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families';
const profiles=fs.readdirSync(base).flatMap(file=>JSON.parse(fs.readFileSync(`${base}/${file}`,'utf8')).profiles) as RollLabelReviewProfile[];

test('material white and excluded white stay independent; foreign artwork contracts are discarded',()=>{
 const white=profiles.find(p=>p.key==='54008:1003764')!;
 assert.equal(rollLabelArtworkForState(white,white.optionStates!.initialStateId!)[0].kind,'white');
 const excluded=profiles.find(p=>p.key==='55626:1024912')!;
 assert.deepEqual(rollLabelArtworkForState(excluded,excluded.optionStates!.initialStateId!),[]);
 assert.deepEqual(rollLabelArtworkForState({...white,artworkInstructions:{...white.artworkInstructions!,profileKey:excluded.key}},white.optionStates!.initialStateId!),[]);
});

test('foil to UV source transition swaps the documented mask rather than stacking both',()=>{
 const profile=profiles.find(p=>p.key==='65613:1299725')!;
 const foil=profile.optionStates!.states.find(s=>s.options['2861']==='16885')!;
 const uv=profile.optionStates!.states.find(s=>s.options['2861']==='16889')!;
 assert.ok(foil);assert.ok(uv);
 const first=rollLabelArtworkForState(profile,foil.id);assert.equal(first.length,1);assert.equal(first[0].kind,'hot_foil');
 const second=rollLabelArtworkForState(profile,uv.id);assert.equal(second.length,1);assert.equal(second[0].kind,'spot_uv');
 assert.ok(second[0].instructionsDa[0].includes('lack'));assert.ok(!second[0].instructionsDa[0].includes('praegung'));
 assert.deepEqual(rollLabelArtworkForState(profile,'foreign-state'),[]);
});
