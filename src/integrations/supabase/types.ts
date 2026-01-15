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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      id_cards: {
        Row: {
          back_image_url: string | null
          card_number: string
          created_at: string
          front_image_url: string | null
          generated_at: string
          id: string
          pdf_url: string | null
          status: string | null
          student_id: string
          template_id: string
        }
        Insert: {
          back_image_url?: string | null
          card_number: string
          created_at?: string
          front_image_url?: string | null
          generated_at?: string
          id?: string
          pdf_url?: string | null
          status?: string | null
          student_id: string
          template_id: string
        }
        Update: {
          back_image_url?: string | null
          card_number?: string
          created_at?: string
          front_image_url?: string | null
          generated_at?: string
          id?: string
          pdf_url?: string | null
          status?: string | null
          student_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "id_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      id_templates: {
        Row: {
          assigned_schools: string[] | null
          back_design: Json | null
          background_back_url: string | null
          background_front_url: string | null
          card_height: number
          card_width: number
          created_at: string
          created_by: string | null
          description: string | null
          front_design: Json
          id: string
          is_default: boolean | null
          name: string
          status: string | null
          target_batch: string | null
          target_class: string | null
          updated_at: string
        }
        Insert: {
          assigned_schools?: string[] | null
          back_design?: Json | null
          background_back_url?: string | null
          background_front_url?: string | null
          card_height?: number
          card_width?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          front_design?: Json
          id?: string
          is_default?: boolean | null
          name: string
          status?: string | null
          target_batch?: string | null
          target_class?: string | null
          updated_at?: string
        }
        Update: {
          assigned_schools?: string[] | null
          back_design?: Json | null
          background_back_url?: string | null
          background_front_url?: string | null
          card_height?: number
          card_width?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          front_design?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          status?: string | null
          target_batch?: string | null
          target_class?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          assigned_to: string | null
          card_ids: string[]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          job_number: string
          notes: string | null
          pdf_url: string | null
          status: string | null
          title: string
          total_cards: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          card_ids?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          job_number: string
          notes?: string | null
          pdf_url?: string | null
          status?: string | null
          title: string
          total_cards?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          card_ids?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          job_number?: string
          notes?: string | null
          pdf_url?: string | null
          status?: string | null
          title?: string
          total_cards?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          institution_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          institution_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          institution_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          address_font_size: number | null
          batch: string | null
          design_overrides: Json | null
          blood_group: string | null
          class: string | null
          created_at: string
          department: string | null
          dob: string | null
          email: string | null
          guardian_name: string | null
          id: string
          name: string
          phone: string | null
          photo_ref: string | null
          photo_url: string | null
          print_batch_id: string | null
          roll_number: string
          school_id: string | null
          updated_at: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          address_font_size?: number | null
          batch?: string | null
          design_overrides?: Json | null
          blood_group?: string | null
          class?: string | null
          created_at?: string
          department?: string | null
          dob?: string | null
          email?: string | null
          guardian_name?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_ref?: string | null
          photo_url?: string | null
          print_batch_id?: string | null
          roll_number: string
          school_id?: string | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          address_font_size?: number | null
          batch?: string | null
          design_overrides?: Json | null
          blood_group?: string | null
          class?: string | null
          created_at?: string
          department?: string | null
          dob?: string | null
          email?: string | null
          guardian_name?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_ref?: string | null
          photo_url?: string | null
          print_batch_id?: string | null
          roll_number?: string
          school_id?: string | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      dashboard_access_links: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          last_used_at: string | null
          refresh_token: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          refresh_token: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          refresh_token?: string
          user_id?: string
        }
        Relationships: []
      }
      print_batches: {
        Row: {
          batch_name: string
          created_at: string
          id: string
          school_id: string
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          batch_name: string
          created_at?: string
          id?: string
          school_id: string
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          batch_name?: string
          created_at?: string
          id?: string
          school_id?: string
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "printer" | "school"
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
      app_role: ["admin", "teacher", "printer", "school"],
    },
  },
} as const
