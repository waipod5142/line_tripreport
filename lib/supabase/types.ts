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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          organization_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          organization_id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      line_groups: {
        Row: {
          created_at: string
          group_name: string | null
          id: string
          joined_at: string | null
          last_message_at: string | null
          line_group_id: string
          organization_id: string | null
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          id?: string
          joined_at?: string | null
          last_message_at?: string | null
          line_group_id: string
          organization_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: string | null
          id?: string
          joined_at?: string | null
          last_message_at?: string | null
          line_group_id?: string
          organization_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      line_members: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_seen_at: string | null
          line_user_id: string
          organization_id: string
          picture_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
          line_user_id: string
          organization_id: string
          picture_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
          line_user_id?: string
          organization_id?: string
          picture_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      line_messages: {
        Row: {
          created_at: string
          id: string
          is_unsent: boolean
          line_group_id: string | null
          line_member_id: string | null
          line_message_id: string | null
          message_type: string
          organization_id: string | null
          processing_status: string
          quoted_line_message_id: string | null
          raw_message: Json
          sent_at: string
          text_content: string | null
          updated_at: string
          webhook_event_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unsent?: boolean
          line_group_id?: string | null
          line_member_id?: string | null
          line_message_id?: string | null
          message_type: string
          organization_id?: string | null
          processing_status?: string
          quoted_line_message_id?: string | null
          raw_message: Json
          sent_at: string
          text_content?: string | null
          updated_at?: string
          webhook_event_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unsent?: boolean
          line_group_id?: string | null
          line_member_id?: string | null
          line_message_id?: string | null
          message_type?: string
          organization_id?: string | null
          processing_status?: string
          quoted_line_message_id?: string | null
          raw_message?: Json
          sent_at?: string
          text_content?: string | null
          updated_at?: string
          webhook_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_messages_line_group_id_fkey"
            columns: ["line_group_id"]
            isOneToOne: false
            referencedRelation: "line_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_messages_line_member_id_fkey"
            columns: ["line_member_id"]
            isOneToOne: false
            referencedRelation: "line_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_messages_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          line_message_id: string
          mime_type: string | null
          organization_id: string
          original_filename: string | null
          retrieval_status: string
          scan_status: string | null
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          line_message_id: string
          mime_type?: string | null
          organization_id: string
          original_filename?: string | null
          retrieval_status?: string
          scan_status?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          line_message_id?: string
          mime_type?: string | null
          organization_id?: string
          original_filename?: string | null
          retrieval_status?: string
          scan_status?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_line_message_id_fkey"
            columns: ["line_message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          locale: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          locale?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          locale?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          organization_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          destination: string | null
          event_timestamp: string | null
          event_type: string
          id: string
          is_redelivery: boolean
          last_error: string | null
          processing_attempts: number
          processing_status: string
          raw_payload: Json
          received_at: string
          signature_verified: boolean
          updated_at: string
          webhook_event_id: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          event_timestamp?: string | null
          event_type: string
          id?: string
          is_redelivery?: boolean
          last_error?: string | null
          processing_attempts?: number
          processing_status?: string
          raw_payload: Json
          received_at?: string
          signature_verified: boolean
          updated_at?: string
          webhook_event_id: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          event_timestamp?: string | null
          event_type?: string
          id?: string
          is_redelivery?: boolean
          last_error?: string | null
          processing_attempts?: number
          processing_status?: string
          raw_payload?: Json
          received_at?: string
          signature_verified?: boolean
          updated_at?: string
          webhook_event_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      is_org_writer: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
