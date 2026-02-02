export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attribute_library_groups: {
        Row: {
          created_at: string | null
          default_ui_mode: string
          id: string
          kind: string
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_ui_mode?: string
          id?: string
          kind: string
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_ui_mode?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attribute_library_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_library_values: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          group_id: string
          height_mm: number | null
          id: string
          key: string | null
          meta: Json | null
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
          width_mm: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          group_id: string
          height_mm?: number | null
          id?: string
          key?: string | null
          meta?: Json | null
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
          width_mm?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          group_id?: string
          height_mm?: number | null
          id?: string
          key?: string | null
          meta?: Json | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attribute_library_values_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "attribute_library_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribute_library_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material?: string
          price_per_sqm?: number
          tenant_id?: string
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banner_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_rates: {
        Row: {
          id: string
          material: string
          price_per_sqm: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          material: string
          price_per_sqm: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          material?: string
          price_per_sqm?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banner_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      beachflag_prices: {
        Row: {
          base_price: number
          id: string
          quantity: number
          size: string
          system: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price: number
          id?: string
          quantity?: number
          size: string
          system: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price?: number
          id?: string
          quantity?: number
          size?: string
          system?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beachflag_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booklet_rates: {
        Row: {
          base_price: number
          format: string
          id: string
          pages: string
          paper: string
          price_per_unit: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price: number
          format: string
          id?: string
          pages: string
          paper: string
          price_per_unit: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price?: number
          format?: string
          id?: string
          pages?: string
          paper?: string
          price_per_unit?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booklet_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json
          id: string
          label: string | null
          tenant_id: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: Json
          id?: string
          label?: string | null
          tenant_id: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json
          id?: string
          label?: string | null
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      color_profiles: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          file_size_bytes: number | null
          id: string
          kind: string
          name: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          name: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          name?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "color_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_accounts: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      company_hub_items: {
        Row: {
          company_id: string | null
          created_at: string | null
          default_options: Json
          default_quantity: number
          design_id: string | null
          id: string
          product_id: string | null
          sort_order: number
          tenant_id: string
          thumbnail_url: string | null
          title: string
          variant_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          default_options?: Json
          default_quantity?: number
          design_id?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number
          tenant_id: string
          thumbnail_url?: string | null
          title: string
          variant_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          default_options?: Json
          default_quantity?: number
          design_id?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number
          tenant_id?: string
          thumbnail_url?: string | null
          title?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_hub_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_hub_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designer_saved_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_hub_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string | null
          custom_field_id: string
          id: string
          record_id: string
          table_name: string
          tenant_id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          custom_field_id: string
          id?: string
          record_id: string
          table_name: string
          tenant_id: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string
          id?: string
          record_id?: string
          table_name?: string
          tenant_id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          default_value: Json | null
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean
          product_id: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          default_value?: Json | null
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          product_id: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          default_value?: Json | null
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          product_id?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_type: string | null
          city: string
          company_name: string | null
          country: string | null
          created_at: string | null
          first_name: string
          id: string
          is_default: boolean | null
          label: string | null
          last_name: string
          phone: string | null
          postal_code: string
          street_address: string
          street_address_2: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_type?: string | null
          city: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_name: string
          phone?: string | null
          postal_code: string
          street_address: string
          street_address_2?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_type?: string | null
          city?: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_name?: string
          phone?: string | null
          postal_code?: string
          street_address?: string
          street_address_2?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      delivery_tracking: {
        Row: {
          carrier: string | null
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          location: string | null
          occurred_at: string | null
          order_id: string | null
          tracking_data: Json | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          location?: string | null
          occurred_at?: string | null
          order_id?: string | null
          tracking_data?: Json | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          location?: string | null
          occurred_at?: string | null
          order_id?: string | null
          tracking_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_library_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          fabric_json: Json | null
          id: string
          kind: string
          name: string
          preview_path: string | null
          product_id: string | null
          storage_path: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fabric_json?: Json | null
          id?: string
          kind: string
          name: string
          preview_path?: string | null
          product_id?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fabric_json?: Json | null
          id?: string
          kind?: string
          name?: string
          preview_path?: string | null
          product_id?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_library_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_exports: {
        Row: {
          color_profile: string | null
          design_id: string
          dpi: number | null
          exported_at: string | null
          exported_by: string | null
          file_size_bytes: number | null
          has_cut_contour: boolean | null
          id: string
          order_id: string | null
          order_item_id: string | null
          pages: number | null
          pdf_standard: string | null
          pdf_url: string
        }
        Insert: {
          color_profile?: string | null
          design_id: string
          dpi?: number | null
          exported_at?: string | null
          exported_by?: string | null
          file_size_bytes?: number | null
          has_cut_contour?: boolean | null
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          pages?: number | null
          pdf_standard?: string | null
          pdf_url: string
        }
        Update: {
          color_profile?: string | null
          design_id?: string
          dpi?: number | null
          exported_at?: string | null
          exported_by?: string | null
          file_size_bytes?: number | null
          has_cut_contour?: boolean | null
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          pages?: number | null
          pdf_standard?: string | null
          pdf_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "designer_exports_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designer_saved_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_saved_designs: {
        Row: {
          bleed_mm: number | null
          color_profile: string | null
          created_at: string | null
          description: string | null
          dpi: number | null
          editor_json: Json
          export_pdf_url: string | null
          height_mm: number
          id: string
          last_exported_at: string | null
          name: string
          preflight_errors_count: number | null
          preflight_warnings: Json | null
          preflight_warnings_count: number | null
          preview_thumbnail_url: string | null
          product_id: string | null
          safe_area_mm: number | null
          status: string | null
          template_id: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string | null
          warnings_accepted: boolean | null
          warnings_accepted_at: string | null
          warnings_accepted_by: string | null
          width_mm: number
        }
        Insert: {
          bleed_mm?: number | null
          color_profile?: string | null
          created_at?: string | null
          description?: string | null
          dpi?: number | null
          editor_json?: Json
          export_pdf_url?: string | null
          height_mm: number
          id?: string
          last_exported_at?: string | null
          name: string
          preflight_errors_count?: number | null
          preflight_warnings?: Json | null
          preflight_warnings_count?: number | null
          preview_thumbnail_url?: string | null
          product_id?: string | null
          safe_area_mm?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
          warnings_accepted?: boolean | null
          warnings_accepted_at?: string | null
          warnings_accepted_by?: string | null
          width_mm: number
        }
        Update: {
          bleed_mm?: number | null
          color_profile?: string | null
          created_at?: string | null
          description?: string | null
          dpi?: number | null
          editor_json?: Json
          export_pdf_url?: string | null
          height_mm?: number
          id?: string
          last_exported_at?: string | null
          name?: string
          preflight_errors_count?: number | null
          preflight_warnings?: Json | null
          preflight_warnings_count?: number | null
          preview_thumbnail_url?: string | null
          product_id?: string | null
          safe_area_mm?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
          warnings_accepted?: boolean | null
          warnings_accepted_at?: string | null
          warnings_accepted_by?: string | null
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "designer_saved_designs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_saved_designs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "designer_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_templates: {
        Row: {
          bleed_mm: number | null
          category: string | null
          color_profile: string | null
          created_at: string | null
          cut_contour_path: string | null
          description: string | null
          dpi_default: number | null
          dpi_min_required: number | null
          height_mm: number
          icon_name: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string
          preview_image_url: string | null
          safe_area_mm: number | null
          safe_area_path: string | null
          supports_cut_contour: boolean | null
          template_pdf_url: string | null
          template_preview_url: string | null
          template_type: string
          tenant_id: string
          trim_path: string | null
          updated_at: string | null
          weight_gsm: number | null
          width_mm: number
        }
        Insert: {
          bleed_mm?: number | null
          category?: string | null
          color_profile?: string | null
          created_at?: string | null
          cut_contour_path?: string | null
          description?: string | null
          dpi_default?: number | null
          dpi_min_required?: number | null
          height_mm: number
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          preview_image_url?: string | null
          safe_area_mm?: number | null
          safe_area_path?: string | null
          supports_cut_contour?: boolean | null
          template_pdf_url?: string | null
          template_preview_url?: string | null
          template_type: string
          tenant_id?: string
          trim_path?: string | null
          updated_at?: string | null
          weight_gsm?: number | null
          width_mm: number
        }
        Update: {
          bleed_mm?: number | null
          category?: string | null
          color_profile?: string | null
          created_at?: string | null
          cut_contour_path?: string | null
          description?: string | null
          dpi_default?: number | null
          dpi_min_required?: number | null
          height_mm?: number
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          preview_image_url?: string | null
          safe_area_mm?: number | null
          safe_area_path?: string | null
          supports_cut_contour?: boolean | null
          template_pdf_url?: string | null
          template_preview_url?: string | null
          template_type?: string
          tenant_id?: string
          trim_path?: string | null
          updated_at?: string | null
          weight_gsm?: number | null
          width_mm?: number
        }
        Relationships: []
      }
      finish_options: {
        Row: {
          created_at: string | null
          finish_machine_id: string | null
          id: string
          name: string
          price_per_m2: number | null
          price_per_min: number | null
          price_per_sheet: number | null
          price_per_unit: number | null
          pricing_mode: string
          run_waste_pct: number | null
          setup_time_min: number | null
          setup_waste_sheets: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          finish_machine_id?: string | null
          id?: string
          name: string
          price_per_m2?: number | null
          price_per_min?: number | null
          price_per_sheet?: number | null
          price_per_unit?: number | null
          pricing_mode: string
          run_waste_pct?: number | null
          setup_time_min?: number | null
          setup_waste_sheets?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          finish_machine_id?: string | null
          id?: string
          name?: string
          price_per_m2?: number | null
          price_per_min?: number | null
          price_per_sheet?: number | null
          price_per_unit?: number | null
          pricing_mode?: string
          run_waste_pct?: number | null
          setup_time_min?: number | null
          setup_waste_sheets?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finish_options_finish_machine_id_fkey"
            columns: ["finish_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finish_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      foil_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material?: string
          price_per_sqm?: number
          tenant_id?: string
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foil_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_prices: {
        Row: {
          fold_type: string
          format: string
          id: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          fold_type: string
          format: string
          id?: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          fold_type?: string
          format?: string
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      generic_product_prices: {
        Row: {
          created_at: string
          extra_data: Json | null
          id: string
          price_dkk: number
          product_id: string
          quantity: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          variant_name: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          extra_data?: Json | null
          id?: string
          price_dkk: number
          product_id: string
          quantity?: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          variant_name: string
          variant_value: string
        }
        Update: {
          created_at?: string
          extra_data?: Json | null
          id?: string
          price_dkk?: number
          product_id?: string
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          variant_name?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generic_product_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ink_sets: {
        Row: {
          created_at: string | null
          default_coverage_pct: number | null
          id: string
          ml_per_m2_at_100pct: number
          name: string
          price_per_ml: number
          tenant_id: string
          tolerance_pct: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_coverage_pct?: number | null
          id?: string
          ml_per_m2_at_100pct: number
          name: string
          price_per_ml: number
          tenant_id: string
          tolerance_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_coverage_pct?: number | null
          id?: string
          ml_per_m2_at_100pct?: number
          name?: string
          price_per_ml?: number
          tenant_id?: string
          tolerance_pct?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ink_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string | null
          duplex_supported: boolean | null
          id: string
          m2_per_hour: number | null
          machine_rate_per_hour: number | null
          margin_bottom_mm: number | null
          margin_left_mm: number | null
          margin_right_mm: number | null
          margin_top_mm: number | null
          mode: string
          name: string
          roll_width_mm: number | null
          run_waste_pct: number | null
          setup_time_min: number | null
          setup_waste_sheets: number | null
          sheet_height_mm: number | null
          sheet_width_mm: number | null
          sheets_per_hour: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duplex_supported?: boolean | null
          id?: string
          m2_per_hour?: number | null
          machine_rate_per_hour?: number | null
          margin_bottom_mm?: number | null
          margin_left_mm?: number | null
          margin_right_mm?: number | null
          margin_top_mm?: number | null
          mode: string
          name: string
          roll_width_mm?: number | null
          run_waste_pct?: number | null
          setup_time_min?: number | null
          setup_waste_sheets?: number | null
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          sheets_per_hour?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duplex_supported?: boolean | null
          id?: string
          m2_per_hour?: number | null
          machine_rate_per_hour?: number | null
          margin_bottom_mm?: number | null
          margin_left_mm?: number | null
          margin_right_mm?: number | null
          margin_top_mm?: number | null
          mode?: string
          name?: string
          roll_width_mm?: number | null
          run_waste_pct?: number | null
          setup_time_min?: number | null
          setup_waste_sheets?: number | null
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          sheets_per_hour?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_profile_tiers: {
        Row: {
          created_at: string | null
          id: string
          margin_profile_id: string
          qty_from: number
          qty_to: number | null
          sort_order: number | null
          tenant_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          margin_profile_id: string
          qty_from: number
          qty_to?: number | null
          sort_order?: number | null
          tenant_id: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          margin_profile_id?: string
          qty_from?: number
          qty_to?: number | null
          sort_order?: number | null
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "margin_profile_tiers_margin_profile_id_fkey"
            columns: ["margin_profile_id"]
            isOneToOne: false
            referencedRelation: "margin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_profile_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_profiles: {
        Row: {
          created_at: string | null
          id: string
          min_margin_pct: number | null
          min_order_price: number | null
          min_order_profit: number | null
          mode: string
          name: string
          rounding_step: number | null
          tenant_id: string
          tier_basis: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_margin_pct?: number | null
          min_order_price?: number | null
          min_order_profit?: number | null
          mode?: string
          name: string
          rounding_step?: number | null
          tenant_id: string
          tier_basis?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          min_margin_pct?: number | null
          min_order_price?: number | null
          min_order_profit?: number | null
          mode?: string
          name?: string
          rounding_step?: number | null
          tenant_id?: string
          tier_basis?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "margin_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_assets: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          file_size_bytes: number | null
          height_px: number | null
          id: string
          is_published: boolean | null
          mime_type: string | null
          name: string
          sort_order: number | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string | null
          updated_by: string | null
          url: string
          width_px: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_published?: boolean | null
          mime_type?: string | null
          name: string
          sort_order?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
          url: string
          width_px?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_published?: boolean | null
          mime_type?: string | null
          name?: string
          sort_order?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
          url?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string | null
          id: string
          material_type: string
          name: string
          price_per_m2: number | null
          price_per_sheet: number | null
          pricing_mode: string
          sheet_height_mm: number | null
          sheet_width_mm: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_type: string
          name: string
          price_per_m2?: number | null
          price_per_sheet?: number | null
          pricing_mode: string
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_type?: string
          name?: string
          price_per_m2?: number | null
          price_per_sheet?: number | null
          pricing_mode?: string
          sheet_height_mm?: number | null
          sheet_width_mm?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_current: boolean | null
          notes: string | null
          order_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          order_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          notes?: string | null
          order_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoices: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string
          order_id: string | null
          paid_at: string | null
          pdf_url: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          total: number
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number: string
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          tax_rate?: number | null
          total: number
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          order_id: string | null
          sender_id: string | null
          sender_type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id?: string | null
          sender_id?: string | null
          sender_type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          order_id?: string | null
          sender_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_internal: boolean | null
          order_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          order_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_internal?: boolean | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_type: string | null
          delivery_zip: string | null
          estimated_delivery: string | null
          has_problem: boolean | null
          id: string
          order_number: string
          problem_description: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          requires_file_reupload: boolean | null
          shipped_at: string | null
          status: string | null
          status_note: string | null
          tenant_id: string | null
          total_price: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_type?: string | null
          delivery_zip?: string | null
          estimated_delivery?: string | null
          has_problem?: boolean | null
          id?: string
          order_number: string
          problem_description?: string | null
          product_name: string
          product_slug?: string | null
          quantity?: number
          requires_file_reupload?: boolean | null
          shipped_at?: string | null
          status?: string | null
          status_note?: string | null
          tenant_id?: string | null
          total_price: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_type?: string | null
          delivery_zip?: string | null
          estimated_delivery?: string | null
          has_problem?: boolean | null
          id?: string
          order_number?: string
          problem_description?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          requires_file_reupload?: boolean | null
          shipped_at?: string | null
          status?: string | null
          status_note?: string | null
          tenant_id?: string | null
          total_price?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      page_designs: {
        Row: {
          branding_data: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_visible: boolean | null
          name: string
          price: number | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          branding_data: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          branding_data?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name?: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      page_seo: {
        Row: {
          created_at: string
          id: string
          keywords: string[] | null
          meta_description: string | null
          og_image_url: string | null
          slug: string
          structured_data: Json | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          og_image_url?: string | null
          slug: string
          structured_data?: Json | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          og_image_url?: string | null
          slug?: string
          structured_data?: Json | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_seo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string | null
          id: string
          page_path: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_path: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      platform_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_role: string | null
          sender_user_id: string | null
          tenant_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_role?: string | null
          sender_user_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_role?: string | null
          sender_user_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_seo_google_integrations: {
        Row: {
          connected_at: string | null
          id: string
          refresh_token: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          id?: string
          refresh_token?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          id?: string
          refresh_token?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_seo_google_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_seo_pages: {
        Row: {
          canonical_url: string | null
          description: string | null
          id: string
          jsonld: Json | null
          lastmod: string | null
          locale: string | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          path: string
          robots: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          canonical_url?: string | null
          description?: string | null
          id?: string
          jsonld?: Json | null
          lastmod?: string | null
          locale?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          path: string
          robots?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          canonical_url?: string | null
          description?: string | null
          id?: string
          jsonld?: Json | null
          lastmod?: string | null
          locale?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          path?: string
          robots?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_seo_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_seo_pagespeed_snapshots: {
        Row: {
          created_at: string | null
          id: string
          lighthouse: Json
          strategy: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lighthouse: Json
          strategy: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lighthouse?: Json
          strategy?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_seo_pagespeed_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_seo_settings: {
        Row: {
          alternate_domains: string[] | null
          canonical_base_url: string
          default_description: string | null
          default_og_image_url: string | null
          default_robots: string | null
          default_title_template: string | null
          id: string
          locales: Json
          organization_jsonld: Json | null
          primary_domain: string
          tenant_id: string
          updated_at: string | null
          website_jsonld: Json | null
        }
        Insert: {
          alternate_domains?: string[] | null
          canonical_base_url?: string
          default_description?: string | null
          default_og_image_url?: string | null
          default_robots?: string | null
          default_title_template?: string | null
          id?: string
          locales?: Json
          organization_jsonld?: Json | null
          primary_domain?: string
          tenant_id: string
          updated_at?: string | null
          website_jsonld?: Json | null
        }
        Update: {
          alternate_domains?: string[] | null
          canonical_base_url?: string
          default_description?: string | null
          default_og_image_url?: string | null
          default_robots?: string | null
          default_title_template?: string | null
          id?: string
          locales?: Json
          organization_jsonld?: Json | null
          primary_domain?: string
          tenant_id?: string
          updated_at?: string | null
          website_jsonld?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_seo_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_api_presets: {
        Row: {
          body: Json | null
          created_at: string | null
          id: string
          method: string
          name: string
          path: string
          query: Json | null
          tenant_id: string
        }
        Insert: {
          body?: Json | null
          created_at?: string | null
          id?: string
          method?: string
          name: string
          path: string
          query?: Json | null
          tenant_id?: string
        }
        Update: {
          body?: Json | null
          created_at?: string | null
          id?: string
          method?: string
          name?: string
          path?: string
          query?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      pod_catalog_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          sort_order: number | null
          supplier_value_ref: Json
          tenant_id: string
          value_key: string
          value_label: Json
        }
        Insert: {
          attribute_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          supplier_value_ref?: Json
          tenant_id?: string
          value_key: string
          value_label?: Json
        }
        Update: {
          attribute_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          supplier_value_ref?: Json
          tenant_id?: string
          value_key?: string
          value_label?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pod_catalog_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_catalog_attributes: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          group_key: string
          group_label: Json
          id: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          group_key: string
          group_label?: Json
          id?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          group_key?: string
          group_label?: Json
          id?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_catalog_attributes_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_catalog_attributes_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_catalog_price_matrix: {
        Row: {
          base_costs: number[]
          catalog_product_id: string
          currency: string | null
          id: string
          needs_quote: boolean | null
          quantities: number[]
          recommended_retail: number[]
          tenant_id: string
          updated_at: string | null
          variant_signature: string
        }
        Insert: {
          base_costs?: number[]
          catalog_product_id: string
          currency?: string | null
          id?: string
          needs_quote?: boolean | null
          quantities?: number[]
          recommended_retail?: number[]
          tenant_id?: string
          updated_at?: string | null
          variant_signature: string
        }
        Update: {
          base_costs?: number[]
          catalog_product_id?: string
          currency?: string | null
          id?: string
          needs_quote?: boolean | null
          quantities?: number[]
          recommended_retail?: number[]
          tenant_id?: string
          updated_at?: string | null
          variant_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_catalog_price_matrix_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_catalog_price_matrix_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_catalog_products: {
        Row: {
          created_at: string | null
          id: string
          public_description: Json | null
          public_images: Json | null
          public_title: Json
          status: string
          supplier_product_data: Json | null
          supplier_product_ref: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json
          status?: string
          supplier_product_data?: Json | null
          supplier_product_ref: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json
          status?: string
          supplier_product_data?: Json | null
          supplier_product_ref?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod_fulfillment_jobs: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          currency: string | null
          error_message: string | null
          id: string
          order_id: string
          order_item_id: string
          provider_job_ref: string | null
          qty: number
          status: string
          stripe_payment_intent_id: string | null
          tenant_cost: number
          tenant_id: string
          updated_at: string | null
          variant_signature: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          order_item_id: string
          provider_job_ref?: string | null
          qty: number
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_cost: number
          tenant_id: string
          updated_at?: string | null
          variant_signature: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          provider_job_ref?: string | null
          qty?: number
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_cost?: number
          tenant_id?: string
          updated_at?: string | null
          variant_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_fulfillment_jobs_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_fulfillment_jobs_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_supplier_connections: {
        Row: {
          api_key_encrypted: string
          auth_header_mode: string
          auth_header_name: string | null
          auth_header_prefix: string | null
          base_url: string
          created_at: string | null
          id: string
          is_active: boolean | null
          provider_key: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          auth_header_mode?: string
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          auth_header_mode?: string
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod_tenant_billing: {
        Row: {
          default_payment_method_id: string | null
          is_ready: boolean | null
          stripe_customer_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          default_payment_method_id?: string | null
          is_ready?: boolean | null
          stripe_customer_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          default_payment_method_id?: string | null
          is_ready?: boolean | null
          stripe_customer_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod_tenant_imports: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          id: string
          product_id: string
          tenant_id: string
          variant_mapping: Json | null
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          id?: string
          product_id: string
          tenant_id: string
          variant_mapping?: Json | null
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          tenant_id?: string
          variant_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_tenant_imports_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_tenant_imports_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod2_api_presets: {
        Row: {
          body: Json | null
          created_at: string | null
          id: string
          method: string
          name: string
          path: string
          query: Json | null
          tenant_id: string
        }
        Insert: {
          body?: Json | null
          created_at?: string | null
          id?: string
          method?: string
          name: string
          path: string
          query?: Json | null
          tenant_id?: string
        }
        Update: {
          body?: Json | null
          created_at?: string | null
          id?: string
          method?: string
          name?: string
          path?: string
          query?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      pod2_catalog_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          sort_order: number | null
          supplier_value_ref: Json
          tenant_id: string
          value_key: string
          value_label: Json
        }
        Insert: {
          attribute_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          supplier_value_ref?: Json
          tenant_id?: string
          value_key: string
          value_label?: Json
        }
        Update: {
          attribute_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          sort_order?: number | null
          supplier_value_ref?: Json
          tenant_id?: string
          value_key?: string
          value_label?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pod2_catalog_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      pod2_catalog_attributes: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          group_key: string
          group_label: Json
          id: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          group_key: string
          group_label?: Json
          id?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          group_key?: string
          group_label?: Json
          id?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod2_catalog_attributes_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod2_catalog_attributes_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod2_catalog_price_matrix: {
        Row: {
          base_costs: number[]
          catalog_product_id: string
          currency: string | null
          id: string
          needs_quote: boolean | null
          quantities: number[]
          recommended_retail: number[]
          tenant_id: string
          updated_at: string | null
          variant_signature: string
        }
        Insert: {
          base_costs?: number[]
          catalog_product_id: string
          currency?: string | null
          id?: string
          needs_quote?: boolean | null
          quantities?: number[]
          recommended_retail?: number[]
          tenant_id?: string
          updated_at?: string | null
          variant_signature: string
        }
        Update: {
          base_costs?: number[]
          catalog_product_id?: string
          currency?: string | null
          id?: string
          needs_quote?: boolean | null
          quantities?: number[]
          recommended_retail?: number[]
          tenant_id?: string
          updated_at?: string | null
          variant_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod2_catalog_price_matrix_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod2_catalog_price_matrix_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod2_catalog_products: {
        Row: {
          created_at: string | null
          id: string
          public_description: Json | null
          public_images: Json | null
          public_title: Json
          status: string
          supplier_product_data: Json | null
          supplier_product_ref: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json
          status?: string
          supplier_product_data?: Json | null
          supplier_product_ref: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json
          status?: string
          supplier_product_data?: Json | null
          supplier_product_ref?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod2_fulfillment_jobs: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          currency: string | null
          error_message: string | null
          id: string
          order_id: string
          order_item_id: string
          provider_job_ref: string | null
          qty: number
          status: string
          stripe_payment_intent_id: string | null
          tenant_cost: number
          tenant_id: string
          updated_at: string | null
          variant_signature: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          order_item_id: string
          provider_job_ref?: string | null
          qty: number
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_cost: number
          tenant_id: string
          updated_at?: string | null
          variant_signature: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          provider_job_ref?: string | null
          qty?: number
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_cost?: number
          tenant_id?: string
          updated_at?: string | null
          variant_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod2_fulfillment_jobs_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod2_fulfillment_jobs_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pod2_supplier_connections: {
        Row: {
          api_key_encrypted: string
          auth_header_mode: string
          auth_header_name: string | null
          auth_header_prefix: string | null
          base_url: string
          created_at: string | null
          id: string
          is_active: boolean | null
          provider_key: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          auth_header_mode?: string
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          auth_header_mode?: string
          auth_header_name?: string | null
          auth_header_prefix?: string | null
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_key?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod2_tenant_billing: {
        Row: {
          default_payment_method_id: string | null
          is_ready: boolean | null
          stripe_customer_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          default_payment_method_id?: string | null
          is_ready?: boolean | null
          stripe_customer_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          default_payment_method_id?: string | null
          is_ready?: boolean | null
          stripe_customer_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod2_tenant_imports: {
        Row: {
          catalog_product_id: string
          created_at: string | null
          id: string
          product_id: string
          tenant_id: string
          variant_mapping: Json | null
        }
        Insert: {
          catalog_product_id: string
          created_at?: string | null
          id?: string
          product_id: string
          tenant_id: string
          variant_mapping?: Json | null
        }
        Update: {
          catalog_product_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          tenant_id?: string
          variant_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pod2_tenant_imports_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod2_tenant_imports_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "pod2_catalog_public"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_prices: {
        Row: {
          format: string
          id: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          format: string
          id?: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          format?: string
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_rates: {
        Row: {
          id: string
          paper: string
          price_per_sqm: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          paper: string
          price_per_sqm: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          paper?: string
          price_per_sqm?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      premade_designs: {
        Row: {
          branding_data: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_visible: boolean | null
          name: string
          price: number | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          branding_data: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          branding_data?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name?: string
          price?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      price_cache: {
        Row: {
          id: string
          option_signature: string
          price_json: Json
          product_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          option_signature: string
          price_json: Json
          product_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          option_signature?: string
          price_json?: Json
          product_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_cache_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          product_id: string
          spec: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          product_id: string
          spec?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          product_id?: string
          spec?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_profiles: {
        Row: {
          created_at: string | null
          default_bleed_mm: number | null
          default_gap_mm: number | null
          id: string
          include_bleed_in_ink: boolean | null
          ink_set_id: string | null
          machine_id: string | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_bleed_mm?: number | null
          default_gap_mm?: number | null
          id?: string
          include_bleed_in_ink?: boolean | null
          ink_set_id?: string | null
          machine_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_bleed_mm?: number | null
          default_gap_mm?: number | null
          id?: string
          include_bleed_in_ink?: boolean | null
          ink_set_id?: string | null
          machine_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_profiles_ink_set_id_fkey"
            columns: ["ink_set_id"]
            isOneToOne: false
            referencedRelation: "ink_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_profiles_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_flyers: {
        Row: {
          created_at: string
          format: string
          id: string
          paper: string
          price_dkk: number
          quantity: number
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          paper: string
          price_dkk: number
          quantity: number
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
        }
        Relationships: []
      }
      product_attribute_groups: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          kind: string
          library_group_id: string | null
          name: string
          product_id: string
          sort_order: number | null
          source: string
          tenant_id: string
          ui_mode: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          kind: string
          library_group_id?: string | null
          name: string
          product_id: string
          sort_order?: number | null
          source?: string
          tenant_id: string
          ui_mode?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          kind?: string
          library_group_id?: string | null
          name?: string
          product_id?: string
          sort_order?: number | null
          source?: string
          tenant_id?: string
          ui_mode?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_groups_library_group_id_fkey"
            columns: ["library_group_id"]
            isOneToOne: false
            referencedRelation: "attribute_library_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          group_id: string
          height_mm: number | null
          id: string
          key: string | null
          meta: Json | null
          name: string
          product_id: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
          width_mm: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          group_id: string
          height_mm?: number | null
          id?: string
          key?: string | null
          meta?: Json | null
          name: string
          product_id: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
          width_mm?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          group_id?: string
          height_mm?: number | null
          id?: string
          key?: string | null
          meta?: Json | null
          name?: string
          product_id?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_group_assignments: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          option_group_id: string
          product_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          option_group_id: string
          product_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          option_group_id?: string
          product_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_group_assignments_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_group_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_group_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          description: string | null
          display_type: string
          id: string
          label: string
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          label: string
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          label?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          description: string | null
          extra_price: number
          group_id: string
          icon_url: string | null
          id: string
          label: string
          name: string
          price_mode: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_price?: number
          group_id: string
          icon_url?: string | null
          id?: string
          label: string
          name: string
          price_mode?: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_price?: number
          group_id?: string
          icon_url?: string | null
          id?: string
          label?: string
          name?: string
          price_mode?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_configs: {
        Row: {
          allowed_sides: string
          bleed_mm: number | null
          created_at: string | null
          display_mode: string | null
          finish_ids: string[] | null
          gap_mm: number | null
          id: string
          margin_profile_id: string | null
          material_ids: string[] | null
          numbering_enabled: boolean | null
          numbering_positions: number | null
          numbering_price_per_unit: number | null
          numbering_setup_fee: number | null
          pricing_profile_id: string | null
          pricing_type: string
          product_id: string
          quantities: number[]
          sizes: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          allowed_sides?: string
          bleed_mm?: number | null
          created_at?: string | null
          display_mode?: string | null
          finish_ids?: string[] | null
          gap_mm?: number | null
          id?: string
          margin_profile_id?: string | null
          material_ids?: string[] | null
          numbering_enabled?: boolean | null
          numbering_positions?: number | null
          numbering_price_per_unit?: number | null
          numbering_setup_fee?: number | null
          pricing_profile_id?: string | null
          pricing_type?: string
          product_id: string
          quantities?: number[]
          sizes?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          allowed_sides?: string
          bleed_mm?: number | null
          created_at?: string | null
          display_mode?: string | null
          finish_ids?: string[] | null
          gap_mm?: number | null
          id?: string
          margin_profile_id?: string | null
          material_ids?: string[] | null
          numbering_enabled?: boolean | null
          numbering_positions?: number | null
          numbering_price_per_unit?: number | null
          numbering_setup_fee?: number | null
          pricing_profile_id?: string | null
          pricing_type?: string
          product_id?: string
          quantities?: number[]
          sizes?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_configs_margin_profile_id_fkey"
            columns: ["margin_profile_id"]
            isOneToOne: false
            referencedRelation: "margin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_configs_pricing_profile_id_fkey"
            columns: ["pricing_profile_id"]
            isOneToOne: false
            referencedRelation: "pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          about_description: string | null
          about_image_url: string | null
          about_title: string | null
          banner_config: Json | null
          category: string
          created_at: string
          created_by: string | null
          default_quantity: number | null
          default_variant: string | null
          description: string
          icon_text: string | null
          id: string
          image_url: string | null
          is_available_to_tenants: boolean | null
          is_published: boolean
          name: string
          output_color_profile_id: string | null
          preset_key: string | null
          pricing_structure: Json | null
          pricing_type: string
          slug: string
          technical_specs: Json | null
          template_files: Json | null
          tenant_id: string
          tooltip_price: string | null
          tooltip_product: string | null
          tooltip_quick_tilbud: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          about_description?: string | null
          about_image_url?: string | null
          about_title?: string | null
          banner_config?: Json | null
          category: string
          created_at?: string
          created_by?: string | null
          default_quantity?: number | null
          default_variant?: string | null
          description: string
          icon_text?: string | null
          id?: string
          image_url?: string | null
          is_available_to_tenants?: boolean | null
          is_published?: boolean
          name: string
          output_color_profile_id?: string | null
          preset_key?: string | null
          pricing_structure?: Json | null
          pricing_type: string
          slug: string
          technical_specs?: Json | null
          template_files?: Json | null
          tenant_id: string
          tooltip_price?: string | null
          tooltip_product?: string | null
          tooltip_quick_tilbud?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          about_description?: string | null
          about_image_url?: string | null
          about_title?: string | null
          banner_config?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          default_quantity?: number | null
          default_variant?: string | null
          description?: string
          icon_text?: string | null
          id?: string
          image_url?: string | null
          is_available_to_tenants?: boolean | null
          is_published?: boolean
          name?: string
          output_color_profile_id?: string | null
          preset_key?: string | null
          pricing_structure?: Json | null
          pricing_type?: string
          slug?: string
          technical_specs?: Json | null
          template_files?: Json | null
          tenant_id?: string
          tooltip_price?: string | null
          tooltip_product?: string | null
          tooltip_quick_tilbud?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_output_color_profile_id_fkey"
            columns: ["output_color_profile_id"]
            isOneToOne: false
            referencedRelation: "color_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resource_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      salesfolder_rates: {
        Row: {
          base_price: number
          format: string
          id: string
          paper: string
          price_per_unit: number
          side_type: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price: number
          format: string
          id?: string
          paper: string
          price_per_unit: number
          side_type: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price?: number
          format?: string
          id?: string
          paper?: string
          price_per_unit?: number
          side_type?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salesfolder_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material: string
          price_per_sqm: number
          tenant_id: string
          to_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          discount_percent?: number
          from_sqm?: number
          id?: string
          material?: string
          price_per_sqm?: number
          tenant_id?: string
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_rates: {
        Row: {
          id: string
          material: string
          price_per_sqm: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          material: string
          price_per_sqm: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          material?: string
          price_per_sqm?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_rates: {
        Row: {
          format: string
          id: string
          material: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          format?: string
          id?: string
          material: string
          price_dkk?: number
          quantity?: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          format?: string
          id?: string
          material?: string
          price_dkk?: number
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sticker_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_configs: {
        Row: {
          created_at: string | null
          global_markup_pct: number
          id: string
          layout_rows: Json
          product_id: string
          quantities: number[]
          rounding_step: number
          tenant_id: string
          updated_at: string | null
          vertical_axis: Json | null
        }
        Insert: {
          created_at?: string | null
          global_markup_pct?: number
          id?: string
          layout_rows?: Json
          product_id: string
          quantities?: number[]
          rounding_step?: number
          tenant_id: string
          updated_at?: string | null
          vertical_axis?: Json | null
        }
        Update: {
          created_at?: string | null
          global_markup_pct?: number
          id?: string
          layout_rows?: Json
          product_id?: string
          quantities?: number[]
          rounding_step?: number
          tenant_id?: string
          updated_at?: string | null
          vertical_axis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_configs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_finish_price_tiers: {
        Row: {
          finish_id: string
          from_m2: number
          id: string
          is_anchor: boolean
          markup_pct: number
          price_per_m2: number
          product_id: string
          sort_order: number
          tenant_id: string
          to_m2: number | null
        }
        Insert: {
          finish_id: string
          from_m2: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          price_per_m2: number
          product_id: string
          sort_order?: number
          tenant_id: string
          to_m2?: number | null
        }
        Update: {
          finish_id?: string
          from_m2?: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          price_per_m2?: number
          product_id?: string
          sort_order?: number
          tenant_id?: string
          to_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_finish_price_tiers_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "storformat_finishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_finish_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_finish_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_finishes: {
        Row: {
          created_at: string | null
          fixed_price_per_unit: number
          group_label: string | null
          id: string
          interpolation_enabled: boolean
          markup_pct: number
          name: string
          pricing_mode: string
          product_id: string
          sort_order: number
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fixed_price_per_unit?: number
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          name: string
          pricing_mode: string
          product_id: string
          sort_order?: number
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fixed_price_per_unit?: number
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          name?: string
          pricing_mode?: string
          product_id?: string
          sort_order?: number
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_finishes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_finishes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_material_price_tiers: {
        Row: {
          from_m2: number
          id: string
          is_anchor: boolean
          markup_pct: number
          material_id: string
          price_per_m2: number
          product_id: string
          sort_order: number
          tenant_id: string
          to_m2: number | null
        }
        Insert: {
          from_m2: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          material_id: string
          price_per_m2: number
          product_id: string
          sort_order?: number
          tenant_id: string
          to_m2?: number | null
        }
        Update: {
          from_m2?: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          material_id?: string
          price_per_m2?: number
          product_id?: string
          sort_order?: number
          tenant_id?: string
          to_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_material_price_tiers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "storformat_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_material_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_material_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_materials: {
        Row: {
          allow_split: boolean
          bleed_mm: number
          created_at: string | null
          group_label: string | null
          id: string
          interpolation_enabled: boolean
          markup_pct: number
          max_height_mm: number | null
          max_width_mm: number | null
          name: string
          product_id: string
          safe_area_mm: number
          sort_order: number
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          allow_split?: boolean
          bleed_mm?: number
          created_at?: string | null
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          max_height_mm?: number | null
          max_width_mm?: number | null
          name: string
          product_id: string
          safe_area_mm?: number
          sort_order?: number
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_split?: boolean
          bleed_mm?: number
          created_at?: string | null
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          max_height_mm?: number | null
          max_width_mm?: number | null
          name?: string
          product_id?: string
          safe_area_mm?: number
          sort_order?: number
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_price_list_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          product_id: string
          spec: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          product_id: string
          spec?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          product_id?: string
          spec?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_price_list_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_price_list_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_product_fixed_prices: {
        Row: {
          id: string
          price: number
          product_id: string
          product_item_id: string
          quantity: number
          sort_order: number
          tenant_id: string
        }
        Insert: {
          id?: string
          price?: number
          product_id: string
          product_item_id: string
          quantity: number
          sort_order?: number
          tenant_id: string
        }
        Update: {
          id?: string
          price?: number
          product_id?: string
          product_item_id?: string
          quantity?: number
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storformat_product_fixed_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_product_fixed_prices_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "storformat_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_product_fixed_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_product_price_tiers: {
        Row: {
          from_m2: number
          id: string
          is_anchor: boolean
          markup_pct: number
          price_per_m2: number
          product_id: string
          product_item_id: string
          sort_order: number
          tenant_id: string
          to_m2: number | null
        }
        Insert: {
          from_m2: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          price_per_m2: number
          product_id: string
          product_item_id: string
          sort_order?: number
          tenant_id: string
          to_m2?: number | null
        }
        Update: {
          from_m2?: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number
          price_per_m2?: number
          product_id?: string
          product_item_id?: string
          sort_order?: number
          tenant_id?: string
          to_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_product_price_tiers_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "storformat_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_product_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storformat_products: {
        Row: {
          created_at: string | null
          group_label: string | null
          id: string
          initial_price: number
          interpolation_enabled: boolean
          markup_pct: number
          name: string
          pricing_mode: string
          product_id: string
          sort_order: number
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          initial_price?: number
          interpolation_enabled?: boolean
          markup_pct?: number
          name: string
          pricing_mode: string
          product_id: string
          sort_order?: number
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          initial_price?: number
          interpolation_enabled?: boolean
          markup_pct?: number
          name?: string
          pricing_mode?: string
          product_id?: string
          sort_order?: number
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_updates: {
        Row: {
          changes: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          version: string
        }
        Insert: {
          changes: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          version: string
        }
        Update: {
          changes?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          version?: string
        }
        Relationships: []
      }
      tenant_banner_library: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tenant_id: string
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          tenant_id: string
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_banner_library_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notifications: {
        Row: {
          content: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          sender_id: string | null
          status: string | null
          tenant_id: string
          title: string
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          status?: string | null
          tenant_id: string
          title: string
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_page_designs: {
        Row: {
          design_id: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          design_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          design_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_page_designs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "page_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_settings: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          currency: string | null
          details_submitted: boolean
          payouts_enabled: boolean
          platform_fee_flat_ore: number | null
          platform_fee_percent: number | null
          provider: string
          status: string
          stripe_account_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          platform_fee_flat_ore?: number | null
          platform_fee_percent?: number | null
          provider?: string
          status?: string
          stripe_account_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          platform_fee_flat_ore?: number | null
          platform_fee_percent?: number | null
          provider?: string
          status?: string
          stripe_account_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_pending_items: {
        Row: {
          applied_at: string | null
          id: string
          item_id: string
          item_name: string
          item_type: string
          price: number
          tenant_id: string
        }
        Insert: {
          applied_at?: string | null
          id?: string
          item_id: string
          item_name: string
          item_type: string
          price: number
          tenant_id: string
        }
        Update: {
          applied_at?: string | null
          id?: string
          item_id?: string
          item_name?: string
          item_type?: string
          price?: number
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_premade_designs: {
        Row: {
          design_id: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          design_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          design_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_premade_designs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "premade_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_purchases: {
        Row: {
          currency: string | null
          id: string
          item_id: string
          item_name: string
          item_type: string
          price_paid: number
          purchased_at: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          currency?: string | null
          id?: string
          item_id: string
          item_name: string
          item_type: string
          price_paid: number
          purchased_at?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          currency?: string | null
          id?: string
          item_id?: string
          item_name?: string
          item_type?: string
          price_paid?: number
          purchased_at?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_update_status: {
        Row: {
          applied_at: string | null
          id: string
          status: string
          tenant_id: string | null
          update_id: string | null
        }
        Insert: {
          applied_at?: string | null
          id?: string
          status: string
          tenant_id?: string | null
          update_id?: string | null
        }
        Update: {
          applied_at?: string | null
          id?: string
          status?: string
          tenant_id?: string | null
          update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_update_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_update_status_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "system_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          is_platform_owned: boolean | null
          name: string
          owner_id: string | null
          settings: Json | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_platform_owned?: boolean | null
          name: string
          owner_id?: string | null
          settings?: Json | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_platform_owned?: boolean | null
          name?: string
          owner_id?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visitkort_prices: {
        Row: {
          id: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          paper: string
          price_dkk: number
          quantity: number
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitkort_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pod_catalog_public: {
        Row: {
          created_at: string | null
          id: string | null
          public_description: Json | null
          public_images: Json | null
          public_title: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pod2_catalog_public: {
        Row: {
          created_at: string | null
          id: string | null
          public_description: Json | null
          public_images: Json | null
          public_title: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          public_description?: Json | null
          public_images?: Json | null
          public_title?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      check_tenant_access: { Args: { t_id: string }; Returns: boolean }
      clone_product: {
        Args: { source_product_id: string; target_tenant_id: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_pod_master_admin: { Args: never; Returns: boolean }
      is_pod2_master_admin: { Args: never; Returns: boolean }
      seed_tenant_from_master: {
        Args: { target_tenant_id: string }
        Returns: undefined
      }
      send_product_to_tenants:
        | {
            Args: { master_product_id: string; tenant_ids: string[] }
            Returns: Json
          }
        | {
            Args: {
              delivery_mode?: string
              master_product_id: string
              tenant_ids: string[]
            }
            Returns: Json
          }
      send_tenant_notification: {
        Args: {
          noti_content: string
          noti_data: Json
          noti_title: string
          noti_type: string
          target_tenant_id: string
        }
        Returns: undefined
      }
      sync_missing_products: {
        Args: { target_tenant_id: string }
        Returns: undefined
      }
      sync_specific_product: {
        Args: { product_slug: string; target_tenant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "master_admin"
      custom_field_type: "number" | "boolean"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "master_admin"],
      custom_field_type: ["number", "boolean"],
    },
  },
} as const
