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
          image_url: string | null
          is_published: boolean
          name: string
          pricing_type: string
          slug: string
          template_files: Json | null
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
          id?: string
          image_url?: string | null
          is_published?: boolean
          name: string
          pricing_type: string
          slug: string
          template_files?: Json | null
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
          id?: string
          image_url?: string | null
          is_published?: boolean
          name?: string
          pricing_type?: string
          slug?: string
          template_files?: Json | null
          tooltip_price?: string | null
          tooltip_product?: string | null
          tooltip_quick_tilbud?: string | null
          updated_at?: string
          updated_by?: string | null
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
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
      custom_field_type: ["number", "boolean"],
    },
  },
} as const
