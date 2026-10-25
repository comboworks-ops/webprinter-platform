import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIGNAL_DEFAULTS, signalSettings, withSignalSettings } from './pvcbannerSettings.ts';
test('legacy branding never replaces the selected Signal design',()=>{
 assert.deepEqual(signalSettings({themeSettings:{visualStyleId:'print-familiar'}}),SIGNAL_DEFAULTS);
});
test('edits preserve existing draft settings and never mutate published data',()=>{
 const published={themeSettings:{visualStyleId:'print-familiar',other:{retained:true}},header:{logoText:'original'}};
 const draft=withSignalSettings(published,{heroTitle:'New heading',primary:'#123456'});
 assert.equal(signalSettings(draft).heroTitle,'New heading');
 assert.equal(signalSettings(published).heroTitle,SIGNAL_DEFAULTS.heroTitle);
 assert.deepEqual(draft.themeSettings.other,{retained:true});
 assert.deepEqual(draft.header,published.header);
 assert.equal(signalSettings(JSON.parse(JSON.stringify(draft))).primary,'#123456');
});
test('blank copy and hidden sections survive round trips',()=>{
 assert.equal(signalSettings(withSignalSettings({}, {footerText:'',showHero:false})).footerText,'');
 assert.equal(signalSettings(withSignalSettings({}, {footerText:'',showHero:false})).showHero,false);
});
test('untrusted URLs, colors and fonts cannot enter the rendered package',()=>{
 const b=signalSettings({themeSettings:{pvcbannerSignal:{logo:'javascript:alert(1)',heroLink:'//outside.test',storyImage:'https://example.com/image.png',primary:'red;display:none',headingFont:'evil',showHero:'false'}}});
 assert.equal(b.logo,SIGNAL_DEFAULTS.logo);assert.equal(b.heroLink,SIGNAL_DEFAULTS.heroLink);
 assert.equal(b.storyImage,'https://example.com/image.png');assert.equal(b.primary,SIGNAL_DEFAULTS.primary);assert.equal(b.headingFont,'Anton');assert.equal(b.showHero,true);
});

test('deep controls bound dimensions, enforce enums and retain links',()=>{
 const b=signalSettings(withSignalSettings({}, {heroSize:999,heroMobileSize:-1,lineHeight:NaN,dropdownStyle:'bad',ribbonLink1:'javascript:alert(1)',buttonBackground:'red',secondaryLink:'/produkter?gruppe=Bannere'}));
 assert.equal(b.heroSize,140);assert.equal(b.heroMobileSize,28);assert.equal(b.lineHeight,1.6);
 assert.equal(b.dropdownStyle,'cards');assert.equal(b.ribbonLink1,SIGNAL_DEFAULTS.ribbonLink1);
 assert.equal(b.buttonBackground,SIGNAL_DEFAULTS.buttonBackground);assert.equal(b.secondaryLink,'/produkter?gruppe=Bannere');
});
test('global palette inherits until explicitly overridden and future fields survive',()=>{
 const initial={themeSettings:{pvcbannerSignal:{futureOption:'retain'}}};
 const draft=withSignalSettings(initial,{primary:'#123456'});
 assert.equal(draft.themeSettings.pvcbannerSignal.futureOption,'retain');
 assert.equal(signalSettings(draft).buttonBackground,'#123456');
 const changed=withSignalSettings(draft,{buttonBackground:'#ffffff',primary:'#654321'});
 assert.equal(signalSettings(changed).buttonBackground,'#ffffff');
 assert.equal(signalSettings(changed).ribbonBackground,'#654321');
});
test('full deep settings survive JSON save and reload without modifying old layout',()=>{
 const before={themeSettings:{visualStyleId:'print-familiar'},forside:{hero:{legacy:true}}};
 const changed=withSignalSettings(before,{dropdownStyle:'list',heroLayout:'split',ribbonMode:'image',showProducts:false,buttonRadius:24,heroMobileSize:42});
 const b=signalSettings(JSON.parse(JSON.stringify(changed)));
 assert.equal(b.dropdownStyle,'list');assert.equal(b.heroLayout,'split');assert.equal(b.ribbonMode,'image');assert.equal(b.showProducts,false);assert.equal(b.buttonRadius,24);assert.equal(b.heroMobileSize,42);
 assert.deepEqual(changed.forside,before.forside);assert.equal(before.themeSettings.visualStyleId,'print-familiar');
});

test('page introductions persist without replacing native product settings', () => {
 const original = {themeSettings:{other:{keep:true}},productPage:{heading:{customText:'Native title'}}};
 const draft = withSignalSettings(original,{contactTitle:'Tal med os',aboutIntro:'En ny introduktion',guideTitle:'Filguide',pageTitleSize:80});
 const reloaded = JSON.parse(JSON.stringify(draft));
 assert.equal(signalSettings(reloaded).contactTitle,'Tal med os');
 assert.equal(signalSettings(reloaded).guideTitle,'Filguide');
 assert.equal(signalSettings(reloaded).pageTitleSize,80);
 assert.deepEqual(reloaded.productPage,original.productPage);
 assert.deepEqual(reloaded.themeSettings.other,original.themeSettings.other);
 assert.equal(signalSettings({themeSettings:{pvcbannerSignal:{pageTitleSize:999,guideIntro:42}}}).pageTitleSize,100);
});
