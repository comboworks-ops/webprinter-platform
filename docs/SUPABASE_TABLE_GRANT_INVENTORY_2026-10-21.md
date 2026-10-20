# Public table grant inventory

Static inventory of 194 SQL files. A named GRANT is not proof of sufficient or safe access.

A missing named GRANT is a review candidate, not an instruction to expose the table.

| Table | CREATE files | Named access statements |
| --- | --- | --- |
| `addon_library_fixed_prices` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `addon_library_groups` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `addon_library_items` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `addon_library_price_tiers` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `attribute_library_groups` | 20260108100000_attribute_builder.sql<br>20260108_attribute_builder.sql | **No named GRANT/REVOKE found** |
| `attribute_library_values` | 20260108100000_attribute_builder.sql<br>20260108_attribute_builder.sql | **No named GRANT/REVOKE found** |
| `banner_prices` | 20251128231113_5f02771d-742e-4ec5-ab55-15ae20231b87.sql | **No named GRANT/REVOKE found** |
| `banner_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `beachflag_prices` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `booklet_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `branding_versions` | 20260101300000_branding_versions.sql | **No named GRANT/REVOKE found** |
| `checkout_customer_profiles` | 20260310120000_create_checkout_customer_profiles.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260310120000_create_checkout_customer_profiles.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20261020223746_customer_account_explicit_data_api_grants.sql) |
| `color_profiles` | 20260128100000_color_profiles.sql | **No named GRANT/REVOKE found** |
| `company_accounts` | 20260130000000_company_hub.sql | **No named GRANT/REVOKE found** |
| `company_activity_events` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_addresses` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_assets` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_catalog_categories` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_catalog_item_offices` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_consultant_requests` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_hub_items` | 20260130000000_company_hub.sql | **No named GRANT/REVOKE found** |
| `company_member_offices` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_members` | 20260130000000_company_hub.sql | **No named GRANT/REVOKE found** |
| `company_offices` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_order_requests` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_template_bindings` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `company_template_fields` | 20260713090000_company_hub_v2_foundation.sql | REVOKE ALL → anon (20260713090000_company_hub_v2_foundation.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260713090000_company_hub_v2_foundation.sql)<br>GRANT ALL → service_role (20260713090000_company_hub_v2_foundation.sql) |
| `custom_field_values` | 20251128231616_b2cfae99-dfff-44c1-a3ed-eb547d966231.sql | **No named GRANT/REVOKE found** |
| `custom_fields` | 20251128231616_b2cfae99-dfff-44c1-a3ed-eb547d966231.sql | **No named GRANT/REVOKE found** |
| `customer_addresses` | 20231210100000_customer_addresses.sql<br>20231210_customer_addresses.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20231210100000_customer_addresses.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20231210_customer_addresses.sql)<br>GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20261020223746_customer_account_explicit_data_api_grants.sql) |
| `design_library_items` | 20260129000000_design_library.sql | GRANT SELECT → authenticated (20260129000000_design_library.sql)<br>GRANT ALL → service_role (20260129000000_design_library.sql) |
| `designer_exports` | 20251226100000_designer_tables.sql<br>20251226_designer_tables.sql | **No named GRANT/REVOKE found** |
| `designer_saved_designs` | 20251226100000_designer_tables.sql<br>20251226_designer_tables.sql | **No named GRANT/REVOKE found** |
| `designer_templates` | 20251226100000_designer_tables.sql<br>20251226_designer_tables.sql | **No named GRANT/REVOKE found** |
| `erp_shadow_outbox` | 20260727095516_create_erp_shadow_outbox.sql | REVOKE ALL → PUBLIC (20260727095516_create_erp_shadow_outbox.sql)<br>REVOKE ALL → anon, authenticated (20260727095516_create_erp_shadow_outbox.sql)<br>GRANT ALL → service_role (20260727095516_create_erp_shadow_outbox.sql) |
| `foil_prices` | 20251128231113_5f02771d-742e-4ec5-ab55-15ae20231b87.sql | **No named GRANT/REVOKE found** |
| `folder_prices` | 20251113213437_a9423111-ebe3-4651-b4f4-3aca4dabf968.sql | **No named GRANT/REVOKE found** |
| `generic_product_prices` | 20251208122019_d90ef466-ab1c-4424-bf9f-0dd1f6673bca.sql | **No named GRANT/REVOKE found** |
| `icon_assets` | 20260101400000_icon_assets.sql<br>20260101400001_icon_assets.sql | **No named GRANT/REVOKE found** |
| `icon_packs` | 20260101400000_icon_assets.sql<br>20260101400001_icon_assets.sql | **No named GRANT/REVOKE found** |
| `icon_studio_brand_assets` | 20260406130000_icon_studio_phase1.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260406130000_icon_studio_phase1.sql)<br>GRANT ALL → service_role (20260406130000_icon_studio_phase1.sql) |
| `icon_studio_job_outputs` | 20260406130000_icon_studio_phase1.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260406130000_icon_studio_phase1.sql)<br>GRANT ALL → service_role (20260406130000_icon_studio_phase1.sql) |
| `icon_studio_jobs` | 20260406130000_icon_studio_phase1.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260406130000_icon_studio_phase1.sql)<br>GRANT ALL → service_role (20260406130000_icon_studio_phase1.sql) |
| `icon_studio_reference_assets` | 20260406130000_icon_studio_phase1.sql | GRANT SELECT, INSERT, UPDATE, DELETE → authenticated (20260406130000_icon_studio_phase1.sql)<br>GRANT ALL → service_role (20260406130000_icon_studio_phase1.sql) |
| `master_assets` | 20260101200000_master_assets.sql<br>20260101200001_master_assets.sql<br>20260101700000_resource_library.sql | GRANT SELECT → authenticated (20260101200000_master_assets.sql)<br>GRANT ALL → service_role (20260101200000_master_assets.sql)<br>GRANT SELECT → authenticated (20260101200001_master_assets.sql)<br>GRANT ALL → service_role (20260101200001_master_assets.sql)<br>GRANT SELECT → authenticated (20260101700000_resource_library.sql)<br>GRANT ALL → service_role (20260101700000_resource_library.sql) |
| `page_seo` | 20260101400000_fix_seo_tenancy.sql | **No named GRANT/REVOKE found** |
| `pdf_templates` | 20260101500000_pdf_templates.sql | GRANT SELECT → anon (20260101500000_pdf_templates.sql)<br>GRANT SELECT → authenticated (20260101500000_pdf_templates.sql)<br>GRANT ALL → service_role (20260101500000_pdf_templates.sql) |
| `platform_messages` | 20260101300000_platform_messaging.sql<br>20260101300001_platform_messaging.sql | **No named GRANT/REVOKE found** |
| `platform_seo_google_integrations` | 20260106100000_platform_seo_tables.sql<br>20260106_platform_seo_tables.sql | **No named GRANT/REVOKE found** |
| `platform_seo_pages` | 20260106100000_platform_seo_tables.sql<br>20260106_platform_seo_tables.sql | **No named GRANT/REVOKE found** |
| `platform_seo_pagespeed_snapshots` | 20260106100000_platform_seo_tables.sql<br>20260106_platform_seo_tables.sql | **No named GRANT/REVOKE found** |
| `platform_seo_settings` | 20260106100000_platform_seo_tables.sql<br>20260106_platform_seo_tables.sql | **No named GRANT/REVOKE found** |
| `pod2_api_presets` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_catalog_attribute_values` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_catalog_attributes` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_catalog_price_matrix` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_catalog_products` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_fulfillment_jobs` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_supplier_connections` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_tenant_billing` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2_tenant_imports` | 20260128120000_pod2_system.sql<br>20260128_pod2_system.sql | **No named GRANT/REVOKE found** |
| `pod2x_delivery_tiers` | 20260318_pod2x_clean.sql<br>20260318_pod2x_letterheads.sql | **No named GRANT/REVOKE found** |
| `pod2x_finish_addons` | 20260318_pod2x_clean.sql<br>20260318_pod2x_letterheads.sql | **No named GRANT/REVOKE found** |
| `pod2x_orders` | 20260318_pod2x_clean.sql<br>20260318_pod2x_letterheads.sql | **No named GRANT/REVOKE found** |
| `pod2x_price_cache` | 20260318_pod2x_clean.sql<br>20260318_pod2x_letterheads.sql | **No named GRANT/REVOKE found** |
| `pod2x_products` | 20260318_pod2x_clean.sql<br>20260318_pod2x_letterheads.sql | **No named GRANT/REVOKE found** |
| `pod_api_presets` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_catalog_attribute_values` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_catalog_attributes` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_catalog_price_matrix` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_catalog_products` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_fulfillment_jobs` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_supplier_connections` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_tenant_billing` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `pod_tenant_imports` | 20260107100000_pod_system.sql<br>20260107_pod_system.sql<br>pod_system_clean.sql | **No named GRANT/REVOKE found** |
| `poster_prices` | 20251128231906_6776fa55-2850-49d8-a8f6-fddcf7a0d1b8.sql | **No named GRANT/REVOKE found** |
| `poster_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `premade_designs` | 20241217100000_page_designs.sql<br>20241217_page_designs.sql | REVOKE all → anon, authenticated (20260921160543_site_design_library_access.sql)<br>GRANT select → anon (20260921160543_site_design_library_access.sql)<br>GRANT select, insert, update, delete → authenticated (20260921160543_site_design_library_access.sql)<br>GRANT all → service_role (20260921160543_site_design_library_access.sql) |
| `price_list_templates` | 20260109100000_price_list_templates.sql<br>20260109_price_list_templates.sql | **No named GRANT/REVOKE found** |
| `pricing_hub_folders` | 20260213000000_pricing_hub.sql | **No named GRANT/REVOKE found** |
| `pricing_hub_imports` | 20260213000000_pricing_hub.sql | **No named GRANT/REVOKE found** |
| `pricing_hub_projects` | 20260213000000_pricing_hub.sql | **No named GRANT/REVOKE found** |
| `product_addon_imports` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `product_addon_item_overrides` | 20260205000000_addon_library.sql | **No named GRANT/REVOKE found** |
| `product_attribute_groups` | 20260108100000_attribute_builder.sql<br>20260108_attribute_builder.sql | **No named GRANT/REVOKE found** |
| `product_attribute_values` | 20260108100000_attribute_builder.sql<br>20260108_attribute_builder.sql | **No named GRANT/REVOKE found** |
| `product_categories` | 20260108120000_product_presets_categories.sql<br>20260108_product_presets_categories.sql | **No named GRANT/REVOKE found** |
| `product_option_group_assignments` | 20251208120855_3145a7dc-4ce6-44ed-bf77-88beb57fcd84.sql | **No named GRANT/REVOKE found** |
| `product_option_groups` | 20251208120855_3145a7dc-4ce6-44ed-bf77-88beb57fcd84.sql | **No named GRANT/REVOKE found** |
| `product_options` | 20251208120855_3145a7dc-4ce6-44ed-bf77-88beb57fcd84.sql | **No named GRANT/REVOKE found** |
| `product_overviews` | 20260227123000_product_overviews.sql | **No named GRANT/REVOKE found** |
| `products` | 20251125074647_9293a1f7-5469-446d-952d-2c7813534ae7.sql | **No named GRANT/REVOKE found** |
| `profiles` | 20251114114739_6ca85db7-c488-4b84-b9f6-1511be7bdd38.sql | **No named GRANT/REVOKE found** |
| `resource_categories` | 20260101700000_resource_library.sql | GRANT SELECT → authenticated (20260101700000_resource_library.sql)<br>GRANT ALL → service_role (20260101700000_resource_library.sql) |
| `salesfolder_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `sign_prices` | 20251128231113_5f02771d-742e-4ec5-ab55-15ae20231b87.sql | **No named GRANT/REVOKE found** |
| `sign_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `sticker_rates` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |
| `storefront_checkout_attempts` | 20260908171743_storefront_checkout_finalization.sql | REVOKE all → public, anon, authenticated (20260908171743_storefront_checkout_finalization.sql)<br>GRANT select, insert, update → service_role (20260908171743_storefront_checkout_finalization.sql) |
| `storefront_checkout_cancellations` | 20260908171743_storefront_checkout_finalization.sql | REVOKE all → public,anon,authenticated (20260908171743_storefront_checkout_finalization.sql)<br>GRANT select,insert → service_role (20260908171743_storefront_checkout_finalization.sql) |
| `storefront_file_uploads` | 20260916151258_storefront_private_file_access.sql | REVOKE all → public, anon, authenticated (20260916151258_storefront_private_file_access.sql)<br>GRANT select, insert → service_role (20260916151258_storefront_private_file_access.sql) |
| `storefront_legacy_file_links` | 20260916152039_restrict_order_file_storage_reads.sql | REVOKE all → public, anon, authenticated (20260916152039_restrict_order_file_storage_reads.sql)<br>GRANT select → service_role (20260916152039_restrict_order_file_storage_reads.sql) |
| `storefront_order_email_outbox` | 20260908184205_storefront_order_email_outbox.sql | REVOKE all → public,anon,authenticated,service_role (20260908184205_storefront_order_email_outbox.sql)<br>GRANT select,insert,update → service_role (20260908184205_storefront_order_email_outbox.sql) |
| `storformat_configs` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_finish_library` | 20260206011000_storformat_finish_library.sql | **No named GRANT/REVOKE found** |
| `storformat_finish_price_tiers` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_finish_prices` | 20260208000000_storformat_m2_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_finishes` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_m2_prices` | 20260208000000_storformat_m2_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_material_library` | 20260206000000_storformat_material_library.sql | **No named GRANT/REVOKE found** |
| `storformat_material_price_tiers` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_materials` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_price_list_templates` | 20260201090000_storformat_pricing.sql | **No named GRANT/REVOKE found** |
| `storformat_product_fixed_prices` | 20260202100000_storformat_products.sql<br>20260212000000_pricing_redesign.sql | **No named GRANT/REVOKE found** |
| `storformat_product_library` | 20260206012000_storformat_product_library.sql | **No named GRANT/REVOKE found** |
| `storformat_product_m2_prices` | 20260211000000_storformat_products_v2.sql | **No named GRANT/REVOKE found** |
| `storformat_product_price_tiers` | 20260202100000_storformat_products.sql | **No named GRANT/REVOKE found** |
| `storformat_products` | 20260202100000_storformat_products.sql | **No named GRANT/REVOKE found** |
| `supplier_bank_import_jobs` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `supplier_bank_price_delta_reviews` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `supplier_bank_price_snapshots` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `supplier_bank_products` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `supplier_bank_refresh_jobs` | 20260703003500_supplier_bank_refresh_queue.sql | GRANT select, insert, update, delete → authenticated (20260703003500_supplier_bank_refresh_queue.sql)<br>GRANT all → service_role (20260703003500_supplier_bank_refresh_queue.sql)<br>REVOKE all → anon (20260703003500_supplier_bank_refresh_queue.sql) |
| `supplier_bank_scrape_runs` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `supplier_bank_suppliers` | 20260701120000_supplier_product_bank.sql | GRANT select, insert, update, delete → authenticated (20260701120000_supplier_product_bank.sql)<br>GRANT all → service_role (20260701120000_supplier_product_bank.sql)<br>REVOKE all → anon (20260701120000_supplier_product_bank.sql) |
| `system_updates` | 20260101100000_enable_multitenancy.sql<br>20260101120000_consolidated_clean.sql | **No named GRANT/REVOKE found** |
| `tenant_banner_library` | 20260116100000_tenant_banner_library.sql | **No named GRANT/REVOKE found** |
| `tenant_legal_acceptances` | 20260323173000_tenant_legal_acceptances_and_signup_policies.sql | GRANT SELECT, INSERT → authenticated (20260323173000_tenant_legal_acceptances_and_signup_policies.sql)<br>GRANT ALL → service_role (20260323173000_tenant_legal_acceptances_and_signup_policies.sql) |
| `tenant_module_access` | 20260214020000_tenant_module_access.sql | GRANT SELECT, INSERT, UPDATE → authenticated (20260214020000_tenant_module_access.sql)<br>GRANT ALL → service_role (20260214020000_tenant_module_access.sql) |
| `tenant_notifications` | 20260101140000_tenant_notifications.sql | **No named GRANT/REVOKE found** |
| `tenant_payment_settings` | 20260207090000_tenant_payment_settings.sql | GRANT SELECT, INSERT, UPDATE → authenticated (20260207090000_tenant_payment_settings.sql)<br>GRANT ALL → service_role (20260207090000_tenant_payment_settings.sql) |
| `tenant_pending_items` | 20241218100000_tenant_purchases.sql<br>20241218_tenant_purchases.sql | **No named GRANT/REVOKE found** |
| `tenant_pod_shipping_profile` | 20260417090000_pod2_tenant_shipping_profile_remote_applied.sql | **No named GRANT/REVOKE found** |
| `tenant_premade_designs` | 20241217100000_page_designs.sql<br>20241217_page_designs.sql | REVOKE all → anon, authenticated (20260921160543_site_design_library_access.sql)<br>GRANT select, insert, update, delete → authenticated (20260921160543_site_design_library_access.sql)<br>GRANT all → service_role (20260921160543_site_design_library_access.sql) |
| `tenant_purchases` | 20241218100000_tenant_purchases.sql<br>20241218_tenant_purchases.sql | REVOKE insert, update, delete, truncate, references, trigger → anon, authenticated (20260921160543_site_design_library_access.sql)<br>GRANT select → authenticated (20260921160543_site_design_library_access.sql)<br>GRANT all → service_role (20260921160543_site_design_library_access.sql) |
| `tenant_subscriptions` | 20260214010000_tenant_subscriptions.sql | GRANT SELECT, INSERT, UPDATE → authenticated (20260214010000_tenant_subscriptions.sql)<br>GRANT ALL → service_role (20260214010000_tenant_subscriptions.sql) |
| `tenant_update_status` | 20260101100000_enable_multitenancy.sql<br>20260101120000_consolidated_clean.sql | **No named GRANT/REVOKE found** |
| `tenants` | 20260101100000_enable_multitenancy.sql<br>20260101120000_consolidated_clean.sql | **No named GRANT/REVOKE found** |
| `user_roles` | 20251113213437_a9423111-ebe3-4651-b4f4-3aca4dabf968.sql | **No named GRANT/REVOKE found** |
| `visitkort_prices` | 20251116162213_28693ce8-642d-41a8-950c-bb95d65f48eb.sql | **No named GRANT/REVOKE found** |

140 distinct CREATE TABLE names; 99 without a named GRANT anywhere in these files.
