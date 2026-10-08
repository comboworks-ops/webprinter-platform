/** Offline candidate mapping. Existing navigation identities are evidence, not
 * authorization to select a tenant or mutate its catalogue. */
export function buildRollLabelNativeNavigation(index, evidence) {
  const existing = evidence.verifiedExistingMasterNavigation;
  if (evidence.databaseWrites !== false || evidence.targetTenantSelected !== false
    || !existing?.overviewId || !existing.stickerCategoryId || !existing.stickerCategorySlug
    || existing.stickerNavigationMode !== 'all_in_one' || existing.stickerChildren.length
    || index.families.length !== 42 || index.hierarchy.categories.length !== 6) {
    throw Error('Native navigation evidence or catalogue scope changed; review required');
  }
  const root = index.hierarchy.categories.find(category => !category.parent_category_id);
  if (!root || index.hierarchy.categories.filter(category => category.parent_category_id === root.id).length !== 5) {
    throw Error('Expected one roll root and five exact groups');
  }
  const overview = {id:existing.overviewId,name:existing.overviewName,slug:existing.overviewSlug,sort_order:0};
  const sticker = {id:existing.stickerCategoryId,name:existing.stickerCategoryName,slug:existing.stickerCategorySlug,
    overview_id:overview.id,parent_category_id:null,navigation_mode:existing.stickerNavigationMode,sort_order:6};
  return {...index, hierarchy:{overview,categories:[sticker,...index.hierarchy.categories.map(category => ({...category,
    overview_id:overview.id,parent_category_id:category.id === root.id ? sticker.id : category.parent_category_id}))]},
    products:index.products.map(product => ({...product,categoryOverviewId:overview.id})),
    navigationReview:{version:1,candidateTenantId:existing.tenantId,targetTenantSelected:false,databaseWrites:false,
      existingStickerNavigationModePreserved:true,existingProductsIncluded:false,
      liveFingerprintsMustBeRepeated:true,sourceEvidencePath:'import-review/navigation-collision-plan-004.json'}};
}
