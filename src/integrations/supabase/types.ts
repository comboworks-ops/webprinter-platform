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
      banner_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
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
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      banner_rates: {
        Row: {
          id: string
          material: string
          price_per_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          material: string
          price_per_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          material?: string
          price_per_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      beachflag_prices: {
        Row: {
          base_price: number
          id: string
          quantity: number
          size: string
          system: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price: number
          id?: string
          quantity?: number
          size: string
          system: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price?: number
          id?: string
          quantity?: number
          size?: string
          system?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      booklet_rates: {
        Row: {
          base_price: number
          format: string
          id: string
          pages: string
          paper: string
          price_per_unit: number
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
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          created_at: string | null
          custom_field_id: string
          id: string
          record_id: string
          table_name: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          custom_field_id: string
          id?: string
          record_id: string
          table_name: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string
          id?: string
          record_id?: string
          table_name?: string
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
        ]
      }
      foil_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
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
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      folder_prices: {
        Row: {
          fold_type: string
          format: string
          id: string
          paper: string
          price_dkk: number
          quantity: number
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
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      generic_product_prices: {
        Row: {
          created_at: string
          extra_data: Json | null
          id: string
          price_dkk: number
          product_id: string
          quantity: number
          updated_at: string | null
          updated_by: string | null
          variant_name: string
          variant_value: string


          tenant_id: string
        }
        Insert: {
          created_at?: string
          extra_data?: Json | null
          id?: string
          price_dkk: number
          product_id: string
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
          variant_name: string
          variant_value: string


          tenant_id: string
        }
        Update: {
          created_at?: string
          extra_data?: Json | null
          id?: string
          price_dkk?: number
          product_id?: string
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
          variant_name?: string
          variant_value?: string


          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          format: string
          id?: string
          paper: string
          price_dkk: number
          quantity: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          format?: string
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      poster_rates: {
        Row: {
          id: string
          paper: string
          price_per_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          paper: string
          price_per_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          paper?: string
          price_per_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      print_flyers: {
        Row: {
          category: string
          created_at: string | null
          format: string
          handle: string
          id: string
          list_price_dkk: number
          paper: string
          price_dkk: number
          product: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          format: string
          handle: string
          id?: string
          list_price_dkk: number
          paper: string
          price_dkk: number
          product?: string
          quantity: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          format?: string
          handle?: string
          id?: string
          list_price_dkk?: number
          paper?: string
          price_dkk?: number
          product?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_option_group_assignments: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          option_group_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          option_group_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          option_group_id?: string
          product_id?: string
          sort_order?: number
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
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          display_type: string
          id: string
          label: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          display_type?: string
          id?: string
          label: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          display_type?: string
          id?: string
          label?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_options: {
        Row: {
          created_at: string
          extra_price: number
          group_id: string
          icon_url: string | null
          id: string
          label: string
          name: string
          price_mode: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          extra_price?: number
          group_id: string
          icon_url?: string | null
          id?: string
          label: string
          name: string
          price_mode?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          extra_price?: number
          group_id?: string
          icon_url?: string | null
          id?: string
          label?: string
          name?: string
          price_mode?: string
          sort_order?: number
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
          id: string
          icon_text: string | null
          image_url: string | null
          is_published: boolean
          name: string
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


          is_available_to_tenants: boolean | null

          is_ready: boolean | null

          output_color_profile_id: string | null

          preset_key: string | null
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
          id?: string
          icon_text?: string | null
          image_url?: string | null
          is_published?: boolean
          name: string
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


          is_available_to_tenants?: boolean | null

          is_ready?: boolean | null

          output_color_profile_id?: string | null

          preset_key?: string | null
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
          id?: string
          icon_text?: string | null
          image_url?: string | null
          is_published?: boolean
          name?: string
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


          is_available_to_tenants?: boolean | null

          is_ready?: boolean | null

          output_color_profile_id?: string | null

          preset_key?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
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
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
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
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sign_prices: {
        Row: {
          discount_percent: number
          from_sqm: number
          id: string
          material: string
          price_per_sqm: number
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
          to_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sign_rates: {
        Row: {
          id: string
          material: string
          price_per_sqm: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          material: string
          price_per_sqm: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          material?: string
          price_per_sqm?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sticker_rates: {
        Row: {
          format: string
          id: string
          material: string
          price_dkk: number
          quantity: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          format?: string
          id?: string
          material: string
          price_dkk?: number
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          format?: string
          id?: string
          material?: string
          price_dkk?: number
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string


          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string


          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string


          tenant_id?: string | null
        }
        Relationships: []
      }
      visitkort_prices: {
        Row: {
          id: string
          paper: string
          price_dkk: number
          quantity: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          paper: string
          price_dkk: number
          quantity: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          paper?: string
          price_dkk?: number
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }


      addon_library_fixed_prices: {
        Row: {
          addon_item_id: string
          created_at: string | null
          id: string
          price: number
          quantity: number
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          addon_item_id: string
          created_at?: string | null
          id?: string
          price?: number
          quantity: number
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          addon_item_id?: string
          created_at?: string | null
          id?: string
          price?: number
          quantity?: number
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_library_fixed_prices_addon_item_id_fkey"
            columns: ["addon_item_id"]
            isOneToOne: false
            referencedRelation: "addon_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_library_fixed_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      addon_library_groups: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_label: string
          display_type: string
          id: string
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_label: string
          display_type?: string
          id?: string
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_label?: string
          display_type?: string
          id?: string
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_library_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      addon_library_items: {
        Row: {
          base_price: number
          created_at: string | null
          description: string | null
          display_label: string
          enabled: boolean | null
          group_id: string
          icon_url: string | null
          id: string
          markup_pct: number | null
          name: string
          pricing_mode: string
          sort_order: number | null
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          created_at?: string | null
          description?: string | null
          display_label: string
          enabled?: boolean | null
          group_id: string
          icon_url?: string | null
          id?: string
          markup_pct?: number | null
          name: string
          pricing_mode?: string
          sort_order?: number | null
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          description?: string | null
          display_label?: string
          enabled?: boolean | null
          group_id?: string
          icon_url?: string | null
          id?: string
          markup_pct?: number | null
          name?: string
          pricing_mode?: string
          sort_order?: number | null
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_library_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_library_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_library_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      addon_library_price_tiers: {
        Row: {
          addon_item_id: string
          created_at: string | null
          from_m2: number
          id: string
          is_anchor: boolean
          markup_pct: number | null
          price_per_m2: number
          sort_order: number | null
          tenant_id: string
          to_m2: number | null
        }
        Insert: {
          addon_item_id: string
          created_at?: string | null
          from_m2?: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number | null
          price_per_m2?: number
          sort_order?: number | null
          tenant_id: string
          to_m2?: number | null
        }
        Update: {
          addon_item_id?: string
          created_at?: string | null
          from_m2?: number
          id?: string
          is_anchor?: boolean
          markup_pct?: number | null
          price_per_m2?: number
          sort_order?: number | null
          tenant_id?: string
          to_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_library_price_tiers_addon_item_id_fkey"
            columns: ["addon_item_id"]
            isOneToOne: false
            referencedRelation: "addon_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_library_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

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

      checkout_customer_profiles: {
        Row: {
          billing_address: string | null
          billing_address_2: string | null
          billing_city: string | null
          billing_company: string | null
          billing_country: string | null
          billing_name: string | null
          billing_zip: string | null
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_address_2: string | null
          delivery_city: string | null
          delivery_company: string | null
          delivery_country: string | null
          delivery_recipient_name: string | null
          delivery_zip: string | null
          id: string
          label: string
          sender_mode: string
          sender_name: string | null
          updated_at: string
          use_separate_billing_address: boolean
          user_id: string
        }
        Insert: {
          billing_address?: string | null
          billing_address_2?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_zip?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_address_2?: string | null
          delivery_city?: string | null
          delivery_company?: string | null
          delivery_country?: string | null
          delivery_recipient_name?: string | null
          delivery_zip?: string | null
          id?: string
          label: string
          sender_mode?: string
          sender_name?: string | null
          updated_at?: string
          use_separate_billing_address?: boolean
          user_id: string
        }
        Update: {
          billing_address?: string | null
          billing_address_2?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_zip?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_address_2?: string | null
          delivery_city?: string | null
          delivery_company?: string | null
          delivery_country?: string | null
          delivery_recipient_name?: string | null
          delivery_zip?: string | null
          id?: string
          label?: string
          sender_mode?: string
          sender_name?: string | null
          updated_at?: string
          use_separate_billing_address?: boolean
          user_id?: string
        }
        Relationships: []
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
          billing_email: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          industry_key: string | null
          logo_url: string | null
          name: string
          settings: Json
          slug: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          industry_key?: string | null
          logo_url?: string | null
          name: string
          settings?: Json
          slug?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          industry_key?: string | null
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }

      company_activity_events: {
        Row: {
          actor_user_id: string | null
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          office_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          office_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          office_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_activity_events_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_activity_events_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_addresses: {
        Row: {
          city: string
          company_id: string
          company_name: string | null
          country_code: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          office_id: string | null
          phone: string | null
          postal_code: string
          recipient_name: string
          status: string
          street_address: string
          street_address_2: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          city: string
          company_id: string
          company_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          office_id?: string | null
          phone?: string | null
          postal_code: string
          recipient_name: string
          status?: string
          street_address: string
          street_address_2?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          city?: string
          company_id?: string
          company_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          office_id?: string | null
          phone?: string | null
          postal_code?: string
          recipient_name?: string
          status?: string
          street_address?: string
          street_address_2?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_addresses_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_addresses_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_assets: {
        Row: {
          asset_type: string
          company_id: string
          created_at: string
          file_size_bytes: number | null
          id: string
          metadata: Json
          mime_type: string
          name: string
          office_id: string | null
          status: string
          storage_path: string
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_type: string
          company_id: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type: string
          name: string
          office_id?: string | null
          status?: string
          storage_path: string
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          company_id?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          name?: string
          office_id?: string | null
          status?: string
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_assets_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_assets_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_catalog_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_catalog_categories_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }

      company_catalog_item_offices: {
        Row: {
          company_id: string
          created_at: string
          item_id: string
          office_id: string
          tenant_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          item_id: string
          office_id: string
          tenant_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          item_id?: string
          office_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_catalog_item_offices_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_catalog_item_offices_item_fk"
            columns: ["item_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_hub_items"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_catalog_item_offices_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_consultant_requests: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          item_id: string | null
          message: string
          office_id: string | null
          request_type: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          item_id?: string | null
          message: string
          office_id?: string | null
          request_type: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          item_id?: string | null
          message?: string
          office_id?: string | null
          request_type?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_consultant_requests_asset_fk"
            columns: ["asset_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_assets"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_consultant_requests_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_consultant_requests_item_fk"
            columns: ["item_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_hub_items"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_consultant_requests_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_hub_items: {
        Row: {
          category_id: string | null
          company_id: string | null
          created_at: string | null
          default_options: Json
          default_quantity: number
          design_id: string | null
          id: string
          is_featured: boolean
          office_scope: string
          product_id: string | null
          requires_approval: boolean
          short_description: string | null
          sort_order: number
          status: string
          template_binding_id: string | null
          tenant_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          default_options?: Json
          default_quantity?: number
          design_id?: string | null
          id?: string
          is_featured?: boolean
          office_scope?: string
          product_id?: string | null
          requires_approval?: boolean
          short_description?: string | null
          sort_order?: number
          status?: string
          template_binding_id?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          default_options?: Json
          default_quantity?: number
          design_id?: string | null
          id?: string
          is_featured?: boolean
          office_scope?: string
          product_id?: string | null
          requires_approval?: boolean
          short_description?: string | null
          sort_order?: number
          status?: string
          template_binding_id?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_hub_items_category_fk"
            columns: ["category_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_catalog_categories"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
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
          {
            foreignKeyName: "company_hub_items_template_binding_fk"
            columns: ["template_binding_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_template_bindings"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_member_offices: {
        Row: {
          company_id: string
          created_at: string
          office_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          office_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          office_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_member_offices_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_member_offices_member_fk"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["company_id", "user_id"]
          },
          {
            foreignKeyName: "company_member_offices_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
        ]
      }

      company_members: {
        Row: {
          company_id: string
          created_at: string | null
          is_all_offices: boolean
          role: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          is_all_offices?: boolean
          role?: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          is_all_offices?: boolean
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
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

      company_offices: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_default: boolean
          name: string
          phone: string | null
          profile_data: Json
          status: string
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
          profile_data?: Json
          status?: string
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
          profile_data?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_offices_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }

      company_order_requests: {
        Row: {
          address_snapshot: Json | null
          approval_reason: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field_values: Json
          id: string
          item_id: string
          office_id: string | null
          order_id: string | null
          product_configuration: Json
          product_id: string
          quantity: number
          quote_snapshot: Json | null
          quoted_total: number | null
          requested_by: string
          status: string
          template_binding_id: string | null
          template_version: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          approval_reason?: string | null
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field_values?: Json
          id?: string
          item_id: string
          office_id?: string | null
          order_id?: string | null
          product_configuration?: Json
          product_id: string
          quantity: number
          quote_snapshot?: Json | null
          quoted_total?: number | null
          requested_by: string
          status?: string
          template_binding_id?: string | null
          template_version?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          approval_reason?: string | null
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field_values?: Json
          id?: string
          item_id?: string
          office_id?: string | null
          order_id?: string | null
          product_configuration?: Json
          product_id?: string
          quantity?: number
          quote_snapshot?: Json | null
          quoted_total?: number | null
          requested_by?: string
          status?: string
          template_binding_id?: string | null
          template_version?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_order_requests_binding_fk"
            columns: ["template_binding_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_template_bindings"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_order_requests_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_order_requests_item_fk"
            columns: ["item_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_hub_items"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_order_requests_office_fk"
            columns: ["office_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_offices"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_order_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }

      company_template_bindings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          design_id: string | null
          id: string
          item_id: string
          name: string
          output_mode: string
          preview_url: string | null
          source_fingerprint: string | null
          status: string
          template_id: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          id?: string
          item_id: string
          name: string
          output_mode?: string
          preview_url?: string | null
          source_fingerprint?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          id?: string
          item_id?: string
          name?: string
          output_mode?: string
          preview_url?: string | null
          source_fingerprint?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_template_bindings_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_template_bindings_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designer_saved_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_template_bindings_item_fk"
            columns: ["item_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_hub_items"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_template_bindings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "designer_templates"
            referencedColumns: ["id"]
          },
        ]
      }

      company_template_fields: {
        Row: {
          allow_position: boolean
          allow_size: boolean
          allow_style: boolean
          allowed_values: Json
          binding_id: string
          company_id: string
          created_at: string
          default_source: string | null
          default_value: Json | null
          fabric_object_id: string
          field_key: string
          field_type: string
          id: string
          is_required: boolean
          label: string
          max_length: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          allow_position?: boolean
          allow_size?: boolean
          allow_style?: boolean
          allowed_values?: Json
          binding_id: string
          company_id: string
          created_at?: string
          default_source?: string | null
          default_value?: Json | null
          fabric_object_id: string
          field_key: string
          field_type: string
          id?: string
          is_required?: boolean
          label: string
          max_length?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          allow_position?: boolean
          allow_size?: boolean
          allow_style?: boolean
          allowed_values?: Json
          binding_id?: string
          company_id?: string
          created_at?: string
          default_source?: string | null
          default_value?: Json | null
          fabric_object_id?: string
          field_key?: string
          field_type?: string
          id?: string
          is_required?: boolean
          label?: string
          max_length?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_template_fields_binding_fk"
            columns: ["binding_id", "company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_template_bindings"
            referencedColumns: ["id", "company_id", "tenant_id"]
          },
          {
            foreignKeyName: "company_template_fields_company_fk"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "company_accounts"
            referencedColumns: ["id", "tenant_id"]
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
          editor_json: Json | null
          external_launch_url: string | null
          height_mm: number
          icon_name: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          library_kind: string
          name: string
          preview_image_url: string | null
          safe_area_mm: number | null
          safe_area_path: string | null
          sort_order: number
          source_kind: string
          supports_cut_contour: boolean | null
          tags: string[]
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
          editor_json?: Json | null
          external_launch_url?: string | null
          height_mm: number
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          library_kind?: string
          name: string
          preview_image_url?: string | null
          safe_area_mm?: number | null
          safe_area_path?: string | null
          sort_order?: number
          source_kind?: string
          supports_cut_contour?: boolean | null
          tags?: string[]
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
          editor_json?: Json | null
          external_launch_url?: string | null
          height_mm?: number
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          library_kind?: string
          name?: string
          preview_image_url?: string | null
          safe_area_mm?: number | null
          safe_area_path?: string | null
          sort_order?: number
          source_kind?: string
          supports_cut_contour?: boolean | null
          tags?: string[]
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

      icon_studio_brand_assets: {
        Row: {
          asset_role: string
          created_at: string
          created_by: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          is_default: boolean
          mime_type: string | null
          name: string
          storage_path: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          asset_role?: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          is_default?: boolean
          mime_type?: string | null
          name: string
          storage_path: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          asset_role?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          is_default?: boolean
          mime_type?: string | null
          name?: string
          storage_path?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icon_studio_brand_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      icon_studio_job_outputs: {
        Row: {
          created_at: string
          height_px: number | null
          id: string
          job_id: string
          kind: string
          label: string
          metadata: Json
          mime_type: string | null
          status: string
          storage_path: string
          tenant_id: string
          width_px: number | null
        }
        Insert: {
          created_at?: string
          height_px?: number | null
          id?: string
          job_id: string
          kind?: string
          label: string
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_path: string
          tenant_id: string
          width_px?: number | null
        }
        Update: {
          created_at?: string
          height_px?: number | null
          id?: string
          job_id?: string
          kind?: string
          label?: string
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_path?: string
          tenant_id?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "icon_studio_job_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "icon_studio_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icon_studio_job_outputs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      icon_studio_jobs: {
        Row: {
          approved_output_id: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          job_name: string | null
          payload: Json
          product_key: string
          provider_key: string
          resolved_reference_asset_ids: string[]
          selected_brand_asset_id: string | null
          status: string
          style_key: string
          tenant_id: string
          updated_at: string
          variant_key: string
        }
        Insert: {
          approved_output_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_name?: string | null
          payload?: Json
          product_key: string
          provider_key?: string
          resolved_reference_asset_ids?: string[]
          selected_brand_asset_id?: string | null
          status?: string
          style_key: string
          tenant_id: string
          updated_at?: string
          variant_key: string
        }
        Update: {
          approved_output_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_name?: string | null
          payload?: Json
          product_key?: string
          provider_key?: string
          resolved_reference_asset_ids?: string[]
          selected_brand_asset_id?: string | null
          status?: string
          style_key?: string
          tenant_id?: string
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "icon_studio_jobs_selected_brand_asset_id_fkey"
            columns: ["selected_brand_asset_id"]
            isOneToOne: false
            referencedRelation: "icon_studio_brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icon_studio_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      icon_studio_reference_assets: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_size_bytes: number | null
          finish_key: string | null
          id: string
          is_active: boolean
          metadata: Json
          mime_type: string | null
          name: string
          priority: number
          product_key: string
          storage_path: string
          style_key: string | null
          tenant_id: string
          updated_at: string
          usage_tags: string[]
          variant_key: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size_bytes?: number | null
          finish_key?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          mime_type?: string | null
          name: string
          priority?: number
          product_key: string
          storage_path: string
          style_key?: string | null
          tenant_id: string
          updated_at?: string
          usage_tags?: string[]
          variant_key?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size_bytes?: number | null
          finish_key?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          mime_type?: string | null
          name?: string
          priority?: number
          product_key?: string
          storage_path?: string
          style_key?: string | null
          tenant_id?: string
          updated_at?: string
          usage_tags?: string[]
          variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icon_studio_reference_assets_tenant_id_fkey"
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

      menu_projects: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }

      menu_source_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_source_files_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "menu_projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }

      mpa_attributes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          product_id: string | null
          tenant_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          product_id?: string | null
          tenant_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          product_id?: string | null
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpa_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mpa_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpa_attributes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      mpa_matrix_rows: {
        Row: {
          created_at: string | null
          format: string | null
          id: string
          is_active: boolean | null
          list_price: number | null
          material: string | null
          price: number | null
          product_id: string | null
          quantity: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          format?: string | null
          id?: string
          is_active?: boolean | null
          list_price?: number | null
          material?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          format?: string | null
          id?: string
          is_active?: boolean | null
          list_price?: number | null
          material?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpa_matrix_rows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mpa_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpa_matrix_rows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      mpa_option_groups: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          name: string
          product_id: string | null
          slug: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          name: string
          product_id?: string | null
          slug: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          name?: string
          product_id?: string | null
          slug?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpa_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mpa_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpa_option_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      mpa_options: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          option_group_id: string | null
          price_modifier: number | null
          slug: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          option_group_id?: string | null
          price_modifier?: number | null
          slug: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          option_group_id?: string | null
          price_modifier?: number | null
          slug?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpa_options_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "mpa_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpa_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      mpa_products: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          markup_percent: number | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup_percent?: number | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup_percent?: number | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mpa_products_tenant_id_fkey"
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
          checkout_attempt_id: string | null
          checkout_tax: Json | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_address2: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_type: string | null
          delivery_zip: string | null
          estimated_delivery: string | null
          has_problem: boolean | null
          id: string
          order_number: string
          problem_description: string | null
          product_configuration: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          requires_file_reupload: boolean | null
          shipped_at: string | null
          status: string | null
          status_note: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string | null
          total_price: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          checkout_attempt_id?: string | null
          checkout_tax?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_address2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_type?: string | null
          delivery_zip?: string | null
          estimated_delivery?: string | null
          has_problem?: boolean | null
          id?: string
          order_number: string
          problem_description?: string | null
          product_configuration?: string | null
          product_name: string
          product_slug?: string | null
          quantity?: number
          requires_file_reupload?: boolean | null
          shipped_at?: string | null
          status?: string | null
          status_note?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string | null
          total_price: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          checkout_attempt_id?: string | null
          checkout_tax?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_address2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_type?: string | null
          delivery_zip?: string | null
          estimated_delivery?: string | null
          has_problem?: boolean | null
          id?: string
          order_number?: string
          problem_description?: string | null
          product_configuration?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          requires_file_reupload?: boolean | null
          shipped_at?: string | null
          status?: string | null
          status_note?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string | null
          total_price?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_attempt_id_fkey"
            columns: ["checkout_attempt_id"]
            isOneToOne: false
            referencedRelation: "storefront_checkout_attempts"
            referencedColumns: ["id"]
          },
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
          approved_by_tenant_at: string | null
          approved_by_tenant_user_id: string | null
          catalog_product_id: string
          created_at: string | null
          currency: string | null
          customer_email: string | null
          delivery_summary: string | null
          error_message: string | null
          id: string
          master_notes: string | null
          order_id: string
          order_item_id: string
          printcom_cart_id: string | null
          printcom_cart_item_id: string | null
          printcom_design_id: string | null
          printcom_last_attempt_at: string | null
          printcom_last_error: string | null
          printcom_order_id: string | null
          printcom_order_raw: Json | null
          printcom_payment_verification: string | null
          printcom_payment_verified_at: string | null
          printcom_printjob_id: string | null
          printcom_submission_lock_token: string | null
          printcom_submission_locked_at: string | null
          printcom_submission_step: string | null
          printcom_validated_at: string | null
          printcom_validated_by_user_id: string | null
          printcom_validation_fingerprint: string | null
          printcom_validation_payment_method: string | null
          product_id: string | null
          product_name: string | null
          provider_job_ref: string | null
          qty: number
          recipient_company: string | null
          recipient_name: string | null
          sender_address_json: Json | null
          sender_contact_id: string | null
          sender_logo_url: string | null
          sender_mode: string
          sender_name: string | null
          shipping_method: string | null
          status: string
          stripe_payment_intent_id: string | null
          submitted_by_master_at: string | null
          submitted_by_master_user_id: string | null
          tenant_cost: number
          tenant_id: string
          updated_at: string | null
          variant_signature: string
        }
        Insert: {
          approved_by_tenant_at?: string | null
          approved_by_tenant_user_id?: string | null
          catalog_product_id: string
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          delivery_summary?: string | null
          error_message?: string | null
          id?: string
          master_notes?: string | null
          order_id: string
          order_item_id: string
          printcom_cart_id?: string | null
          printcom_cart_item_id?: string | null
          printcom_design_id?: string | null
          printcom_last_attempt_at?: string | null
          printcom_last_error?: string | null
          printcom_order_id?: string | null
          printcom_order_raw?: Json | null
          printcom_payment_verification?: string | null
          printcom_payment_verified_at?: string | null
          printcom_printjob_id?: string | null
          printcom_submission_lock_token?: string | null
          printcom_submission_locked_at?: string | null
          printcom_submission_step?: string | null
          printcom_validated_at?: string | null
          printcom_validated_by_user_id?: string | null
          printcom_validation_fingerprint?: string | null
          printcom_validation_payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          provider_job_ref?: string | null
          qty: number
          recipient_company?: string | null
          recipient_name?: string | null
          sender_address_json?: Json | null
          sender_contact_id?: string | null
          sender_logo_url?: string | null
          sender_mode?: string
          sender_name?: string | null
          shipping_method?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          submitted_by_master_at?: string | null
          submitted_by_master_user_id?: string | null
          tenant_cost: number
          tenant_id: string
          updated_at?: string | null
          variant_signature: string
        }
        Update: {
          approved_by_tenant_at?: string | null
          approved_by_tenant_user_id?: string | null
          catalog_product_id?: string
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          delivery_summary?: string | null
          error_message?: string | null
          id?: string
          master_notes?: string | null
          order_id?: string
          order_item_id?: string
          printcom_cart_id?: string | null
          printcom_cart_item_id?: string | null
          printcom_design_id?: string | null
          printcom_last_attempt_at?: string | null
          printcom_last_error?: string | null
          printcom_order_id?: string | null
          printcom_order_raw?: Json | null
          printcom_payment_verification?: string | null
          printcom_payment_verified_at?: string | null
          printcom_printjob_id?: string | null
          printcom_submission_lock_token?: string | null
          printcom_submission_locked_at?: string | null
          printcom_submission_step?: string | null
          printcom_validated_at?: string | null
          printcom_validated_by_user_id?: string | null
          printcom_validation_fingerprint?: string | null
          printcom_validation_payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          provider_job_ref?: string | null
          qty?: number
          recipient_company?: string | null
          recipient_name?: string | null
          sender_address_json?: Json | null
          sender_contact_id?: string | null
          sender_logo_url?: string | null
          sender_mode?: string
          sender_name?: string | null
          shipping_method?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          submitted_by_master_at?: string | null
          submitted_by_master_user_id?: string | null
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

      pod2x_delivery_tiers: {
        Row: {
          created_at: string | null
          id: string
          pod2x_product_id: string | null
          printcom_delivery_ids: Json | null
          sort_order: number | null
          tier_description: string | null
          tier_key: string
          tier_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pod2x_product_id?: string | null
          printcom_delivery_ids?: Json | null
          sort_order?: number | null
          tier_description?: string | null
          tier_key: string
          tier_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pod2x_product_id?: string | null
          printcom_delivery_ids?: Json | null
          sort_order?: number | null
          tier_description?: string | null
          tier_key?: string
          tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod2x_delivery_tiers_pod2x_product_id_fkey"
            columns: ["pod2x_product_id"]
            isOneToOne: false
            referencedRelation: "pod2x_products"
            referencedColumns: ["id"]
          },
        ]
      }

      pod2x_finish_addons: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          pod2x_product_id: string | null
          price_dkk: number
          price_type: string | null
          printcom_finish_id: string | null
          printcom_raw_data: Json | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pod2x_product_id?: string | null
          price_dkk: number
          price_type?: string | null
          printcom_finish_id?: string | null
          printcom_raw_data?: Json | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pod2x_product_id?: string | null
          price_dkk?: number
          price_type?: string | null
          printcom_finish_id?: string | null
          printcom_raw_data?: Json | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pod2x_finish_addons_pod2x_product_id_fkey"
            columns: ["pod2x_product_id"]
            isOneToOne: false
            referencedRelation: "pod2x_products"
            referencedColumns: ["id"]
          },
        ]
      }

      pod2x_orders: {
        Row: {
          base_price_dkk: number | null
          created_at: string | null
          delivery_tier: string
          design_count: number | null
          finishes_price_dkk: number | null
          id: string
          local_order_id: string | null
          pod2x_product_id: string | null
          print_data_urls: Json | null
          printcom_order_id: string | null
          printcom_order_status: string | null
          quantity: number
          selected_finish_ids: Json | null
          status: string | null
          submitted_at: string | null
          tenant_id: string | null
          total_price_dkk: number | null
          updated_at: string | null
        }
        Insert: {
          base_price_dkk?: number | null
          created_at?: string | null
          delivery_tier: string
          design_count?: number | null
          finishes_price_dkk?: number | null
          id?: string
          local_order_id?: string | null
          pod2x_product_id?: string | null
          print_data_urls?: Json | null
          printcom_order_id?: string | null
          printcom_order_status?: string | null
          quantity: number
          selected_finish_ids?: Json | null
          status?: string | null
          submitted_at?: string | null
          tenant_id?: string | null
          total_price_dkk?: number | null
          updated_at?: string | null
        }
        Update: {
          base_price_dkk?: number | null
          created_at?: string | null
          delivery_tier?: string
          design_count?: number | null
          finishes_price_dkk?: number | null
          id?: string
          local_order_id?: string | null
          pod2x_product_id?: string | null
          print_data_urls?: Json | null
          printcom_order_id?: string | null
          printcom_order_status?: string | null
          quantity?: number
          selected_finish_ids?: Json | null
          status?: string | null
          submitted_at?: string | null
          tenant_id?: string | null
          total_price_dkk?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod2x_orders_pod2x_product_id_fkey"
            columns: ["pod2x_product_id"]
            isOneToOne: false
            referencedRelation: "pod2x_products"
            referencedColumns: ["id"]
          },
        ]
      }

      pod2x_price_cache: {
        Row: {
          cached_at: string | null
          delivery_tier: string
          design_count: number | null
          expires_at: string | null
          final_price_dkk: number | null
          id: string
          markup_percent: number | null
          pod2x_product_id: string | null
          printcom_delivery_id: string | null
          printcom_price_dkk: number | null
          printcom_price_eur: number | null
          quantity: number
        }
        Insert: {
          cached_at?: string | null
          delivery_tier: string
          design_count?: number | null
          expires_at?: string | null
          final_price_dkk?: number | null
          id?: string
          markup_percent?: number | null
          pod2x_product_id?: string | null
          printcom_delivery_id?: string | null
          printcom_price_dkk?: number | null
          printcom_price_eur?: number | null
          quantity: number
        }
        Update: {
          cached_at?: string | null
          delivery_tier?: string
          design_count?: number | null
          expires_at?: string | null
          final_price_dkk?: number | null
          id?: string
          markup_percent?: number | null
          pod2x_product_id?: string | null
          printcom_delivery_id?: string | null
          printcom_price_dkk?: number | null
          printcom_price_eur?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "pod2x_price_cache_pod2x_product_id_fkey"
            columns: ["pod2x_product_id"]
            isOneToOne: false
            referencedRelation: "pod2x_products"
            referencedColumns: ["id"]
          },
        ]
      }

      pod2x_products: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          design_max: number | null
          design_min: number | null
          id: string
          is_active: boolean | null
          is_imported: boolean | null
          local_product_id: string | null
          name: string
          print_method: string | null
          printcom_product_id: string | null
          printcom_product_url: string | null
          printcom_raw_data: Json | null
          quantity_max: number | null
          quantity_min: number | null
          quantity_step: number | null
          slug: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          design_max?: number | null
          design_min?: number | null
          id?: string
          is_active?: boolean | null
          is_imported?: boolean | null
          local_product_id?: string | null
          name: string
          print_method?: string | null
          printcom_product_id?: string | null
          printcom_product_url?: string | null
          printcom_raw_data?: Json | null
          quantity_max?: number | null
          quantity_min?: number | null
          quantity_step?: number | null
          slug: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          design_max?: number | null
          design_min?: number | null
          id?: string
          is_active?: boolean | null
          is_imported?: boolean | null
          local_product_id?: string | null
          name?: string
          print_method?: string | null
          printcom_product_id?: string | null
          printcom_product_url?: string | null
          printcom_raw_data?: Json | null
          quantity_max?: number | null
          quantity_min?: number | null
          quantity_step?: number | null
          slug?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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

      pricing_hub_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_hub_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pricing_hub_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_hub_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      pricing_hub_imports: {
        Row: {
          attributes_detected: Json | null
          column_mapping: Json | null
          created_at: string | null
          csv_data: Json
          id: string
          name: string
          original_filename: string | null
          project_id: string | null
          row_count: number | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          attributes_detected?: Json | null
          column_mapping?: Json | null
          created_at?: string | null
          csv_data: Json
          id?: string
          name: string
          original_filename?: string | null
          project_id?: string | null
          row_count?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          attributes_detected?: Json | null
          column_mapping?: Json | null
          created_at?: string | null
          csv_data?: Json
          id?: string
          name?: string
          original_filename?: string | null
          project_id?: string | null
          row_count?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_hub_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pricing_hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_hub_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      pricing_hub_projects: {
        Row: {
          combined_data: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          detected_attributes: Json | null
          folder_id: string | null
          id: string
          name: string
          published_to_product_id: string | null
          settings: Json | null
          sort_order: number | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          combined_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          detected_attributes?: Json | null
          folder_id?: string | null
          id?: string
          name: string
          published_to_product_id?: string | null
          settings?: Json | null
          sort_order?: number | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          combined_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          detected_attributes?: Json | null
          folder_id?: string | null
          id?: string
          name?: string
          published_to_product_id?: string | null
          settings?: Json | null
          sort_order?: number | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_hub_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_hub_projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "pricing_hub_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_hub_projects_tenant_id_fkey"
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

      product_addon_imports: {
        Row: {
          addon_group_id: string
          created_at: string | null
          id: string
          import_mode: string
          is_required: boolean | null
          override_display_type: string | null
          override_label: string | null
          product_id: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          addon_group_id: string
          created_at?: string | null
          id?: string
          import_mode?: string
          is_required?: boolean | null
          override_display_type?: string | null
          override_label?: string | null
          product_id: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          addon_group_id?: string
          created_at?: string | null
          id?: string
          import_mode?: string
          is_required?: boolean | null
          override_display_type?: string | null
          override_label?: string | null
          product_id?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_imports_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_library_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_imports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      product_addon_item_overrides: {
        Row: {
          addon_item_id: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          override_markup_pct: number | null
          override_price: number | null
          override_pricing_mode: string | null
          override_sort_order: number | null
          product_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          addon_item_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          override_markup_pct?: number | null
          override_price?: number | null
          override_pricing_mode?: string | null
          override_sort_order?: number | null
          product_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          addon_item_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          override_markup_pct?: number | null
          override_price?: number | null
          override_pricing_mode?: string | null
          override_sort_order?: number | null
          product_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_item_overrides_addon_item_id_fkey"
            columns: ["addon_item_id"]
            isOneToOne: false
            referencedRelation: "addon_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_item_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_item_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          frontend_product_id: string | null
          id: string
          name: string
          navigation_mode: string
          overview_id: string | null
          parent_category_id: string | null
          slug: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          frontend_product_id?: string | null
          id?: string
          name: string
          navigation_mode?: string
          overview_id?: string | null
          parent_category_id?: string | null
          slug: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          frontend_product_id?: string | null
          id?: string
          name?: string
          navigation_mode?: string
          overview_id?: string | null
          parent_category_id?: string | null
          slug?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_frontend_product_id_fkey"
            columns: ["frontend_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_overview_id_fkey"
            columns: ["overview_id"]
            isOneToOne: false
            referencedRelation: "product_overviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          product_id: string | null
          sort_order: number | null
          tenant_id: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string | null
          sort_order?: number | null
          tenant_id: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string | null
          sort_order?: number | null
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      product_matrix: {
        Row: {
          created_at: string | null
          delivery_days: number | null
          format: string | null
          id: string
          is_active: boolean | null
          list_price: number | null
          material: string | null
          price: number | null
          product_id: string | null
          quantity: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_days?: number | null
          format?: string | null
          id?: string
          is_active?: boolean | null
          list_price?: number | null
          material?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          delivery_days?: number | null
          format?: string | null
          id?: string
          is_active?: boolean | null
          list_price?: number | null
          material?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_matrix_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matrix_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      product_overviews: {
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
            foreignKeyName: "product_overviews_tenant_id_fkey"
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

      storefront_checkout_attempts: {
        Row: {
          access_token_hash: string
          amount_ore: number
          completed_at: string | null
          created_at: string
          currency: string
          files_snapshot: Json
          id: string
          livemode: boolean
          order_id: string | null
          order_snapshot: Json
          payment_intent_id: string | null
          quote_snapshot: Json
          request_hash: string
          state: string
          stripe_application_fee: number
          stripe_destination: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          access_token_hash: string
          amount_ore: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          files_snapshot?: Json
          id: string
          livemode: boolean
          order_id?: string | null
          order_snapshot: Json
          payment_intent_id?: string | null
          quote_snapshot: Json
          request_hash: string
          state?: string
          stripe_application_fee?: number
          stripe_destination?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          access_token_hash?: string
          amount_ore?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          files_snapshot?: Json
          id?: string
          livemode?: boolean
          order_id?: string | null
          order_snapshot?: Json
          payment_intent_id?: string | null
          quote_snapshot?: Json
          request_hash?: string
          state?: string
          stripe_application_fee?: number
          stripe_destination?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_checkout_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_checkout_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      storefront_checkout_cancellations: {
        Row: {
          access_token_hash: string
          created_at: string
          id: string
        }
        Insert: {
          access_token_hash: string
          created_at?: string
          id: string
        }
        Update: {
          access_token_hash?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }

      storefront_file_uploads: {
        Row: {
          access_token_hash: string
          created_at: string
          expires_at: string
          file_name: string
          file_size: number
          id: string
          sha256: string
          storage_path: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          access_token_hash: string
          created_at?: string
          expires_at?: string
          file_name: string
          file_size: number
          id: string
          sha256: string
          storage_path: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          access_token_hash?: string
          created_at?: string
          expires_at?: string
          file_name?: string
          file_size?: number
          id?: string
          sha256?: string
          storage_path?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_file_uploads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      storefront_legacy_file_links: {
        Row: {
          order_id: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          order_id: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          order_id?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_legacy_file_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_legacy_file_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      storefront_order_email_outbox: {
        Row: {
          accepted_at: string | null
          attempt_id: string
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          first_attempt_at: string | null
          id: string
          last_error_code: string | null
          livemode: boolean
          message_snapshot: Json
          next_attempt_at: string
          notification_type: string
          order_id: string
          provider_message_id: string | null
          provider_payload: Json | null
          recipient_email: string
          status: string
          tenant_id: string
        }
        Insert: {
          accepted_at?: string | null
          attempt_id: string
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          last_error_code?: string | null
          livemode: boolean
          message_snapshot: Json
          next_attempt_at?: string
          notification_type: string
          order_id: string
          provider_message_id?: string | null
          provider_payload?: Json | null
          recipient_email: string
          status?: string
          tenant_id: string
        }
        Update: {
          accepted_at?: string | null
          attempt_id?: string
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          last_error_code?: string | null
          livemode?: boolean
          message_snapshot?: Json
          next_attempt_at?: string
          notification_type?: string
          order_id?: string
          provider_message_id?: string | null
          provider_payload?: Json | null
          recipient_email?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_order_email_outbox_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "storefront_checkout_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_order_email_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_order_email_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      storformat_configs: {
        Row: {
          area_pricing_basis: string
          created_at: string | null
          global_markup_pct: number
          id: string
          is_published: boolean
          layout_rows: Json
          pricing_mode: string
          product_id: string
          quantities: number[]
          rounding_step: number
          source_quote_model: Json | null
          tenant_id: string
          updated_at: string | null
          vertical_axis: Json | null
        }
        Insert: {
          area_pricing_basis?: string
          created_at?: string | null
          global_markup_pct?: number
          id?: string
          is_published?: boolean
          layout_rows?: Json
          pricing_mode?: string
          product_id: string
          quantities?: number[]
          rounding_step?: number
          source_quote_model?: Json | null
          tenant_id: string
          updated_at?: string | null
          vertical_axis?: Json | null
        }
        Update: {
          area_pricing_basis?: string
          created_at?: string | null
          global_markup_pct?: number
          id?: string
          is_published?: boolean
          layout_rows?: Json
          pricing_mode?: string
          product_id?: string
          quantities?: number[]
          rounding_step?: number
          source_quote_model?: Json | null
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

      storformat_finish_library: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_finish_library_tenant_id_fkey"
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

      storformat_finish_prices: {
        Row: {
          created_at: string | null
          finish_id: string
          fixed_price: number
          id: string
          price_per_m2: number
          pricing_mode: string
          product_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          finish_id: string
          fixed_price?: number
          id?: string
          price_per_m2?: number
          pricing_mode: string
          product_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          finish_id?: string
          fixed_price?: number
          id?: string
          price_per_m2?: number
          pricing_mode?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_finish_prices_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "storformat_finishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_finish_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_finish_prices_tenant_id_fkey"
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
          tags: string[] | null
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
          visibility: string | null
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
          tags?: string[] | null
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
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
          tags?: string[] | null
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
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

      storformat_m2_prices: {
        Row: {
          created_at: string | null
          from_m2: number
          id: string
          is_anchor: boolean
          material_id: string
          price_per_m2: number
          product_id: string
          tenant_id: string
          to_m2: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          from_m2?: number
          id?: string
          is_anchor?: boolean
          material_id: string
          price_per_m2?: number
          product_id: string
          tenant_id: string
          to_m2?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          from_m2?: number
          id?: string
          is_anchor?: boolean
          material_id?: string
          price_per_m2?: number
          product_id?: string
          tenant_id?: string
          to_m2?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_m2_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "storformat_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_m2_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storformat_m2_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      storformat_material_library: {
        Row: {
          created_at: string | null
          id: string
          max_height_mm: number | null
          max_width_mm: number | null
          name: string
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_height_mm?: number | null
          max_width_mm?: number | null
          name: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_height_mm?: number | null
          max_width_mm?: number | null
          name?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_material_library_tenant_id_fkey"
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
          design_library_item_id: string | null
          group_label: string | null
          id: string
          interpolation_enabled: boolean
          markup_pct: number
          max_height_mm: number | null
          max_width_mm: number | null
          min_price: number | null
          name: string
          product_id: string
          safe_area_mm: number
          sort_order: number
          tags: string[] | null
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          allow_split?: boolean
          bleed_mm?: number
          created_at?: string | null
          design_library_item_id?: string | null
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          max_height_mm?: number | null
          max_width_mm?: number | null
          min_price?: number | null
          name: string
          product_id: string
          safe_area_mm?: number
          sort_order?: number
          tags?: string[] | null
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          allow_split?: boolean
          bleed_mm?: number
          created_at?: string | null
          design_library_item_id?: string | null
          group_label?: string | null
          id?: string
          interpolation_enabled?: boolean
          markup_pct?: number
          max_height_mm?: number | null
          max_width_mm?: number | null
          min_price?: number | null
          name?: string
          product_id?: string
          safe_area_mm?: number
          sort_order?: number
          tags?: string[] | null
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_materials_design_library_item_id_fkey"
            columns: ["design_library_item_id"]
            isOneToOne: false
            referencedRelation: "design_library_items"
            referencedColumns: ["id"]
          },
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

      storformat_product_library: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storformat_product_library_tenant_id_fkey"
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
          is_template: boolean | null
          markup_pct: number
          min_price: number | null
          name: string
          percentage_markup: number | null
          pricing_mode: string
          pricing_type: string | null
          product_id: string
          sort_order: number
          tags: string[] | null
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          initial_price?: number
          interpolation_enabled?: boolean
          is_template?: boolean | null
          markup_pct?: number
          min_price?: number | null
          name: string
          percentage_markup?: number | null
          pricing_mode: string
          pricing_type?: string | null
          product_id: string
          sort_order?: number
          tags?: string[] | null
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          initial_price?: number
          interpolation_enabled?: boolean
          is_template?: boolean | null
          markup_pct?: number
          min_price?: number | null
          name?: string
          percentage_markup?: number | null
          pricing_mode?: string
          pricing_type?: string | null
          product_id?: string
          sort_order?: number
          tags?: string[] | null
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string | null
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

      supplier_bank_import_jobs: {
        Row: {
          bank_product_id: string
          created_at: string
          created_by: string | null
          id: string
          import_mode: string
          import_summary: Json
          rollback_note: string | null
          status: string
          target_product_id: string | null
          target_tenant_id: string | null
          updated_at: string
        }
        Insert: {
          bank_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_mode?: string
          import_summary?: Json
          rollback_note?: string | null
          status?: string
          target_product_id?: string | null
          target_tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_mode?: string
          import_summary?: Json
          rollback_note?: string | null
          status?: string
          target_product_id?: string | null
          target_tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_import_jobs_bank_product_id_fkey"
            columns: ["bank_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_import_jobs_target_product_id_fkey"
            columns: ["target_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_import_jobs_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_price_delta_reviews: {
        Row: {
          added_rows: Json
          bank_product_id: string | null
          change_summary: Json
          changed_rows: Json
          created_at: string
          created_by: string | null
          id: string
          new_price_snapshot_id: string | null
          new_snapshot_path: string | null
          notes: string | null
          old_price_snapshot_id: string | null
          old_snapshot_path: string | null
          product_family: string | null
          removed_rows: Json
          status: string
          supplier_id: string | null
          supplier_product_key: string | null
          threshold_pct: number
          updated_at: string
        }
        Insert: {
          added_rows?: Json
          bank_product_id?: string | null
          change_summary?: Json
          changed_rows?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          new_price_snapshot_id?: string | null
          new_snapshot_path?: string | null
          notes?: string | null
          old_price_snapshot_id?: string | null
          old_snapshot_path?: string | null
          product_family?: string | null
          removed_rows?: Json
          status?: string
          supplier_id?: string | null
          supplier_product_key?: string | null
          threshold_pct?: number
          updated_at?: string
        }
        Update: {
          added_rows?: Json
          bank_product_id?: string | null
          change_summary?: Json
          changed_rows?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          new_price_snapshot_id?: string | null
          new_snapshot_path?: string | null
          notes?: string | null
          old_price_snapshot_id?: string | null
          old_snapshot_path?: string | null
          product_family?: string | null
          removed_rows?: Json
          status?: string
          supplier_id?: string | null
          supplier_product_key?: string | null
          threshold_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_price_delta_reviews_bank_product_id_fkey"
            columns: ["bank_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_price_delta_reviews_new_price_snapshot_id_fkey"
            columns: ["new_price_snapshot_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_price_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_price_delta_reviews_old_price_snapshot_id_fkey"
            columns: ["old_price_snapshot_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_price_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_price_delta_reviews_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_price_snapshots: {
        Row: {
          bank_product_id: string
          checksum: string | null
          conversion_rule_key: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          normalized_price_rows: Json
          price_max_dkk: number | null
          price_min_dkk: number | null
          quantity_max: number | null
          quantity_min: number | null
          raw_price_rows: Json
          scrape_run_id: string | null
          supplier_id: string
        }
        Insert: {
          bank_product_id: string
          checksum?: string | null
          conversion_rule_key?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          normalized_price_rows?: Json
          price_max_dkk?: number | null
          price_min_dkk?: number | null
          quantity_max?: number | null
          quantity_min?: number | null
          raw_price_rows?: Json
          scrape_run_id?: string | null
          supplier_id: string
        }
        Update: {
          bank_product_id?: string
          checksum?: string | null
          conversion_rule_key?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          normalized_price_rows?: Json
          price_max_dkk?: number | null
          price_min_dkk?: number | null
          quantity_max?: number | null
          quantity_min?: number | null
          raw_price_rows?: Json
          scrape_run_id?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_price_snapshots_bank_product_id_fkey"
            columns: ["bank_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_price_snapshots_scrape_run_id_fkey"
            columns: ["scrape_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_scrape_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_price_snapshots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_products: {
        Row: {
          created_at: string
          description_da: string | null
          description_original: string | null
          id: string
          last_price_checked_at: string | null
          last_scraped_at: string | null
          latest_scrape_run_id: string | null
          metadata: Json
          name_da: string
          name_original: string
          normalized_attributes: Json
          normalized_pricing_summary: Json
          product_family: string
          raw_snapshot_path: string | null
          scrape_status: string
          source_hash: string | null
          source_language: string | null
          source_url: string | null
          status: string
          supplier_id: string
          supplier_product_key: string
          target_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_da?: string | null
          description_original?: string | null
          id?: string
          last_price_checked_at?: string | null
          last_scraped_at?: string | null
          latest_scrape_run_id?: string | null
          metadata?: Json
          name_da: string
          name_original: string
          normalized_attributes?: Json
          normalized_pricing_summary?: Json
          product_family?: string
          raw_snapshot_path?: string | null
          scrape_status?: string
          source_hash?: string | null
          source_language?: string | null
          source_url?: string | null
          status?: string
          supplier_id: string
          supplier_product_key: string
          target_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_da?: string | null
          description_original?: string | null
          id?: string
          last_price_checked_at?: string | null
          last_scraped_at?: string | null
          latest_scrape_run_id?: string | null
          metadata?: Json
          name_da?: string
          name_original?: string
          normalized_attributes?: Json
          normalized_pricing_summary?: Json
          product_family?: string
          raw_snapshot_path?: string | null
          scrape_status?: string
          source_hash?: string | null
          source_language?: string | null
          source_url?: string | null
          status?: string
          supplier_id?: string
          supplier_product_key?: string
          target_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_products_latest_scrape_run_id_fkey"
            columns: ["latest_scrape_run_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_scrape_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_refresh_jobs: {
        Row: {
          bank_product_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          priority: number
          queued_at: string
          request_summary: Json
          requested_by: string | null
          result_summary: Json
          started_at: string | null
          status: string
          supplier_id: string | null
          tool: string
          updated_at: string
        }
        Insert: {
          bank_product_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          priority?: number
          queued_at?: string
          request_summary?: Json
          requested_by?: string | null
          result_summary?: Json
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          tool?: string
          updated_at?: string
        }
        Update: {
          bank_product_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          priority?: number
          queued_at?: string
          request_summary?: Json
          requested_by?: string | null
          result_summary?: Json
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          tool?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_refresh_jobs_bank_product_id_fkey"
            columns: ["bank_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bank_refresh_jobs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_scrape_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          mode: string
          started_at: string
          started_by: string | null
          status: string
          summary: Json
          supplier_id: string | null
          tool: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          mode: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
          supplier_id?: string | null
          tool: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          mode?: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
          supplier_id?: string | null
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_scrape_runs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }

      supplier_bank_suppliers: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          enabled: boolean
          id: string
          integration_type: string
          metadata: Json
          name: string
          notes: string | null
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          integration_type?: string
          metadata?: Json
          name: string
          notes?: string | null
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          integration_type?: string
          metadata?: Json
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
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

      tenant_feature_toggles: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          feature_key: string
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          feature_key: string
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          feature_key?: string
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_toggles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      tenant_legal_acceptances: {
        Row: {
          accepted_at: string
          accepted_by_user_id: string
          accepted_email: string
          created_at: string
          document_type: string
          document_version: string
          id: string
          ip_address: string | null
          metadata: Json
          source: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          accepted_by_user_id: string
          accepted_email: string
          created_at?: string
          document_type: string
          document_version: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          source?: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          accepted_by_user_id?: string
          accepted_email?: string
          created_at?: string
          document_type?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          source?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_legal_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      tenant_module_access: {
        Row: {
          access_source: string
          created_at: string
          granted_by: string | null
          has_access: boolean
          is_enabled: boolean
          module_id: string
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          access_source?: string
          created_at?: string
          granted_by?: string | null
          has_access?: boolean
          is_enabled?: boolean
          module_id: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          access_source?: string
          created_at?: string
          granted_by?: string | null
          has_access?: boolean
          is_enabled?: boolean
          module_id?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_access_tenant_id_fkey"
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

      tenant_pod_shipping_profile: {
        Row: {
          created_at: string
          notes: string | null
          printcom_contact_id: string | null
          printcom_contact_synced_at: string | null
          printcom_sticky_slip_id: string | null
          sender_city: string | null
          sender_company_name: string | null
          sender_contact_name: string | null
          sender_country: string | null
          sender_email: string | null
          sender_house_number: string | null
          sender_logo_updated_at: string | null
          sender_logo_url: string | null
          sender_mode: string
          sender_phone: string | null
          sender_postcode: string | null
          sender_street: string | null
          sender_vat_number: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          notes?: string | null
          printcom_contact_id?: string | null
          printcom_contact_synced_at?: string | null
          printcom_sticky_slip_id?: string | null
          sender_city?: string | null
          sender_company_name?: string | null
          sender_contact_name?: string | null
          sender_country?: string | null
          sender_email?: string | null
          sender_house_number?: string | null
          sender_logo_updated_at?: string | null
          sender_logo_url?: string | null
          sender_mode?: string
          sender_phone?: string | null
          sender_postcode?: string | null
          sender_street?: string | null
          sender_vat_number?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          notes?: string | null
          printcom_contact_id?: string | null
          printcom_contact_synced_at?: string | null
          printcom_sticky_slip_id?: string | null
          sender_city?: string | null
          sender_company_name?: string | null
          sender_contact_name?: string | null
          sender_country?: string | null
          sender_email?: string | null
          sender_house_number?: string | null
          sender_logo_updated_at?: string | null
          sender_logo_url?: string | null
          sender_mode?: string
          sender_phone?: string | null
          sender_postcode?: string | null
          sender_street?: string | null
          sender_vat_number?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_pod_shipping_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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

      tenant_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          tenant_id: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          tenant_id: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      tenant_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          last_invoice_id: string | null
          last_invoice_status: string | null
          metadata: Json
          plan_id: string
          provider: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          last_invoice_id?: string | null
          last_invoice_status?: string | null
          metadata?: Json
          plan_id?: string
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          last_invoice_id?: string | null
          last_invoice_status?: string | null
          metadata?: Json
          plan_id?: string
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          pod2_auto_forward: boolean
          settings: Json | null
          settings_version: number
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_platform_owned?: boolean | null
          name: string
          owner_id?: string | null
          pod2_auto_forward?: boolean
          settings?: Json | null
          settings_version?: number
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          is_platform_owned?: boolean | null
          name?: string
          owner_id?: string | null
          pod2_auto_forward?: boolean
          settings?: Json | null
          settings_version?: number
        }
        Relationships: []
      }

      track_plays: {
        Row: {
          country_code: string | null
          id: string
          played_at: string
          source: string | null
          track_id: string
          user_id: string | null
        }
        Insert: {
          country_code?: string | null
          id?: string
          played_at?: string
          source?: string | null
          track_id: string
          user_id?: string | null
        }
        Update: {
          country_code?: string | null
          id?: string
          played_at?: string
          source?: string | null
          track_id?: string
          user_id?: string | null
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }


      can_access_tenant: { Args: { _tenant_id: string }; Returns: boolean }

      can_manage_template_library: {
        Args: { _tenant_id: string }
        Returns: boolean
      }

      can_use_icon_studio: { Args: { _tenant_id: string }; Returns: boolean }

      can_use_icon_studio_storage_path: {
        Args: { _object_name: string }
        Returns: boolean
      }

      can_view_template_library: {
        Args: { _is_public: boolean; _tenant_id: string }
        Returns: boolean
      }

      cancel_unstarted_storefront_checkout: {
        Args: { p_access_token_hash: string; p_attempt_id: string }
        Returns: boolean
      }

      check_tenant_access: { Args: { t_id: string }; Returns: boolean }

      claim_storefront_order_emails: {
        Args: {
          p_limit: number
          p_livemode: boolean
          p_recipient_allowlist?: string[]
        }
        Returns: {
          accepted_at: string | null
          attempt_id: string
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          first_attempt_at: string | null
          id: string
          last_error_code: string | null
          livemode: boolean
          message_snapshot: Json
          next_attempt_at: string
          notification_type: string
          order_id: string
          provider_message_id: string | null
          provider_payload: Json | null
          recipient_email: string
          status: string
          tenant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "storefront_order_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }

      clone_product: {
        Args: { source_product_id: string; target_tenant_id: string }
        Returns: string
      }

      clone_product_for_tenant_release: {
        Args: { source_product_id: string; target_tenant_id: string }
        Returns: string
      }

      company_hub_can_access_office: {
        Args: { _company_id: string; _office_id: string }
        Returns: boolean
      }

      company_hub_can_manage: {
        Args: { _company_id: string; _tenant_id: string }
        Returns: boolean
      }

      company_hub_create_order_request: {
        Args: {
          _address_snapshot?: Json
          _company_id: string
          _field_values: Json
          _item_id: string
          _office_id: string
          _product_configuration: Json
          _quantity: number
          _quote_snapshot: Json
          _quoted_total: number
        }
        Returns: {
          address_snapshot: Json | null
          approval_reason: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field_values: Json
          id: string
          item_id: string
          office_id: string | null
          order_id: string | null
          product_configuration: Json
          product_id: string
          quantity: number
          quote_snapshot: Json | null
          quoted_total: number | null
          requested_by: string
          status: string
          template_binding_id: string | null
          template_version: number | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_order_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      company_hub_decide_order_request: {
        Args: { _approve: boolean; _reason?: string; _request_id: string }
        Returns: {
          address_snapshot: Json | null
          approval_reason: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field_values: Json
          id: string
          item_id: string
          office_id: string | null
          order_id: string | null
          product_configuration: Json
          product_id: string
          quantity: number
          quote_snapshot: Json | null
          quoted_total: number | null
          requested_by: string
          status: string
          template_binding_id: string | null
          template_version: number | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_order_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      company_hub_has_role: {
        Args: { _company_id: string; _roles?: string[] }
        Returns: boolean
      }

      company_hub_is_member: { Args: { _company_id: string }; Returns: boolean }

      company_hub_link_order: {
        Args: { _order_id: string; _request_id: string }
        Returns: {
          address_snapshot: Json | null
          approval_reason: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field_values: Json
          id: string
          item_id: string
          office_id: string | null
          order_id: string | null
          product_configuration: Json
          product_id: string
          quantity: number
          quote_snapshot: Json | null
          quoted_total: number | null
          requested_by: string
          status: string
          template_binding_id: string | null
          template_version: number | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_order_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      company_hub_prepare_order_checkout: {
        Args: {
          _product_configuration: Json
          _quantity: number
          _quote_snapshot: Json
          _quoted_total: number
          _request_id: string
        }
        Returns: {
          address_snapshot: Json | null
          approval_reason: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field_values: Json
          id: string
          item_id: string
          office_id: string | null
          order_id: string | null
          product_configuration: Json
          product_id: string
          quantity: number
          quote_snapshot: Json | null
          quoted_total: number | null
          requested_by: string
          status: string
          template_binding_id: string | null
          template_version: number | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_order_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      copy_product_payload_deep: {
        Args: {
          source_product_id: string
          target_product_id: string
          target_tenant_id: string
        }
        Returns: undefined
      }

      customer_finalize_order_file: {
        Args: {
          p_expected_current_file_ids: string[]
          p_file_name: string
          p_file_size: number
          p_order_id: string
          p_storage_path: string
          p_tenant_id: string
          p_validate_only?: boolean
        }
        Returns: string
      }

      customer_mark_order_messages_read: {
        Args: {
          p_message_ids: string[]
          p_order_id: string
          p_tenant_id: string
        }
        Returns: string[]
      }

      delete_product_with_payload: {
        Args: { target_product_id: string }
        Returns: boolean
      }

      design_library_storage_tenant: {
        Args: { _name: string }
        Returns: string
      }

      duplicate_product_with_payload: {
        Args: { source_product_id: string }
        Returns: string
      }

      ensure_product_taxonomy_for_tenant: {
        Args: { _category_name: string; _tenant_id: string }
        Returns: undefined
      }

      finalize_storefront_checkout: {
        Args: {
          p_amount_ore: number
          p_attempt_id: string
          p_currency: string
          p_livemode: boolean
          p_payment_intent_id: string
        }
        Returns: Json
      }

      finish_storefront_order_email: {
        Args: {
          p_claim_token: string
          p_error_code?: string
          p_id: string
          p_provider_message_id?: string
          p_status: string
        }
        Returns: boolean
      }

      generate_order_number: { Args: never; Returns: string }

      import_new_flyer_special_prices: {
        Args: { payload: Json }
        Returns: number
      }

      is_admin: { Args: never; Returns: boolean }

      is_pod_master_admin: { Args: never; Returns: boolean }

      is_pod2_master_admin: { Args: never; Returns: boolean }

      is_supplier_bank_master_admin: { Args: never; Returns: boolean }

      pod2_claim_printcom_submission: {
        Args: {
          p_job_id: string
          p_payment_method: string
          p_payment_verification: string
          p_requested_by: string
          p_validation_fingerprint: string
        }
        Returns: Json
      }

      prepare_storefront_order_email: {
        Args: { p_claim_token: string; p_id: string; p_payload: Json }
        Returns: Json
      }

      remap_jsonb_uuid_strings: {
        Args: { id_map: Json; payload: Json }
        Returns: Json
      }

      seed_tenant_from_master: {
        Args: { target_tenant_id: string }
        Returns: undefined
      }

      send_product_to_tenants: {
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

      storefront_order_file_is_bound: {
        Args: { p_order_id: string; p_path: string }
        Returns: boolean
      }

      sync_missing_products: {
        Args: { target_tenant_id: string }
        Returns: undefined
      }

      sync_specific_product: {
        Args: { product_slug: string; target_tenant_id: string }
        Returns: undefined
      }

      tenant_branding_settings_compare_and_swap: {
        Args: {
          p_branding_patch: Json
          p_expected_settings: Json
          p_tenant_id: string
        }
        Returns: {
          id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      custom_field_type: "number" | "boolean"
    }
    CompositeTypes: Record<string, never>
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
      app_role: ["admin", "moderator", "user"],
      custom_field_type: ["number", "boolean"],
    },
  },
} as const
