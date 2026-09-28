import assert from 'node:assert/strict';
import test from 'node:test';
import { getActiveAdminWorkspaceGroup, getAdminWorkspaceGroups, withAdminWorkspaceContext } from './workspaceNavigation.ts';

test('tenant navigation excludes all supplier, platform and master tools', () => {
  const groups = getAdminWorkspaceGroups({ isMasterContext: false, hasIconStudio: false });
  assert.ok(!groups.some(group => group.id === 'platform'));
  const links = groups.flatMap(group => group.links);
  assert.ok(links.every(link => !link.masterOnly && !link.iconStudio));
  assert.ok(!links.some(link => /pod|supplier|printproduktion/.test(link.path)));
  assert.ok(links.some(link => link.path === '/admin/abonnement'));
});

test('master context retains advanced recovery tools without tenant billing navigation', () => {
  const links = getAdminWorkspaceGroups({ isMasterContext: true, hasIconStudio: true }).flatMap(group => group.links);
  assert.ok(links.some(link => link.path === '/admin/pod2' && link.advanced));
  assert.ok(links.some(link => link.path === '/admin/icon-studio'));
  assert.ok(links.every(link => !link.tenantOnly));
});

test('context links preserve existing queries, explicit target context and fragment', () => {
  assert.equal(withAdminWorkspaceContext('/admin/kunder?orderId=42#files', '?force_domain=shop.dk&page=3'), '/admin/kunder?orderId=42&force_domain=shop.dk#files');
  assert.equal(withAdminWorkspaceContext('/admin?force_domain=other.dk', '?force_domain=shop.dk'), '/admin?force_domain=other.dk');
  assert.equal(withAdminWorkspaceContext('/shop', '?force_domain=shop.dk'), '/shop');
  assert.equal(withAdminWorkspaceContext('/administrator', '?force_domain=shop.dk'), '/administrator');
});

test('nested product, account and legacy routes resolve the precise navigation area', () => {
  assert.equal(getActiveAdminWorkspaceGroup('/admin/product/flyers'), 'products');
  assert.equal(getActiveAdminWorkspaceGroup('/admin/indstillinger/betaling'), 'account');
  assert.equal(getActiveAdminWorkspaceGroup('/admin/pod2-katalog'), 'platform');
  assert.equal(getActiveAdminWorkspaceGroup('/admin/platform-seo/callback'), 'platform');
  assert.equal(getActiveAdminWorkspaceGroup('/admin'), 'overview');
  assert.equal(getActiveAdminWorkspaceGroup('/admin/missing'), undefined);
});
