// Generated from the live Supabase schema. Regenerate after migrations with:
//   supabase gen types typescript --project-id ewzelfrdlgokvpnsyxos > lib/supabase/types.ts
// (or via the Supabase MCP `generate_typescript_types`).

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
      ai_extractions: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          input_hash: string
          input_tokens: number | null
          latency_ms: number | null
          message_id: string
          model: string
          organization_id: string
          output_json: Json | null
          output_tokens: number | null
          overall_confidence: number | null
          prompt_version: string
          provider: string
          schema_version: string
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_hash: string
          input_tokens?: number | null
          latency_ms?: number | null
          message_id: string
          model: string
          organization_id: string
          output_json?: Json | null
          output_tokens?: number | null
          overall_confidence?: number | null
          prompt_version: string
          provider: string
          schema_version: string
          status: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_hash?: string
          input_tokens?: number | null
          latency_ms?: number | null
          message_id?: string
          model?: string
          organization_id?: string
          output_json?: Json | null
          output_tokens?: number | null
          overall_confidence?: number | null
          prompt_version?: string
          provider?: string
          schema_version?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          line_member_id: string | null
          name_en: string | null
          name_th: string | null
          organization_id: string
          phone_display: string | null
          phone_normalized: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          line_member_id?: string | null
          name_en?: string | null
          name_th?: string | null
          organization_id: string
          phone_display?: string | null
          phone_normalized?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          line_member_id?: string | null
          name_en?: string | null
          name_th?: string | null
          organization_id?: string
          phone_display?: string | null
          phone_normalized?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_line_member_id_fkey"
            columns: ["line_member_id"]
            isOneToOne: false
            referencedRelation: "line_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_organization_id_fkey"
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
          classification: string | null
          created_at: string
          id: string
          is_unsent: boolean
          last_error: string | null
          line_group_id: string | null
          line_member_id: string | null
          line_message_id: string | null
          message_type: string
          organization_id: string | null
          processing_attempts: number
          processing_status: string
          quoted_line_message_id: string | null
          raw_message: Json
          sent_at: string
          text_content: string | null
          updated_at: string
          webhook_event_id: string
        }
        Insert: {
          classification?: string | null
          created_at?: string
          id?: string
          is_unsent?: boolean
          last_error?: string | null
          line_group_id?: string | null
          line_member_id?: string | null
          line_message_id?: string | null
          message_type: string
          organization_id?: string | null
          processing_attempts?: number
          processing_status?: string
          quoted_line_message_id?: string | null
          raw_message: Json
          sent_at: string
          text_content?: string | null
          updated_at?: string
          webhook_event_id: string
        }
        Update: {
          classification?: string | null
          created_at?: string
          id?: string
          is_unsent?: boolean
          last_error?: string | null
          line_group_id?: string | null
          line_member_id?: string | null
          line_message_id?: string | null
          message_type?: string
          organization_id?: string | null
          processing_attempts?: number
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
      message_trip_links: {
        Row: {
          confidence: number | null
          confirmed_by: string | null
          created_at: string
          id: string
          link_method: string
          message_id: string
          trip_id: string
        }
        Insert: {
          confidence?: number | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          link_method: string
          message_id: string
          trip_id: string
        }
        Update: {
          confidence?: number | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          link_method?: string
          message_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_trip_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_trip_links_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
      review_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          message_id: string | null
          organization_id: string
          priority: string
          proposed_changes: Json | null
          reason_code: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          organization_id: string
          priority?: string
          proposed_changes?: Json | null
          reason_code: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          organization_id?: string
          priority?: string
          proposed_changes?: Json | null
          reason_code?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_items_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_containers: {
        Row: {
          container_number: string
          container_role: string | null
          created_at: string
          id: string
          source_message_id: string | null
          trip_id: string
        }
        Insert: {
          container_number: string
          container_role?: string | null
          created_at?: string
          id?: string
          source_message_id?: string | null
          trip_id: string
        }
        Update: {
          container_number?: string
          container_role?: string | null
          created_at?: string
          id?: string
          source_message_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_containers_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_containers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_drivers: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          source_message_id: string | null
          trip_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          source_message_id?: string | null
          trip_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          source_message_id?: string | null
          trip_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_drivers_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_drivers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          confidence: number | null
          confirmation_status: string
          created_at: string
          description: string | null
          event_at: string | null
          event_type: string
          id: string
          idempotency_key: string
          is_void: boolean
          organization_id: string
          raw_label: string | null
          source_message_id: string | null
          source_type: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          confirmation_status?: string
          created_at?: string
          description?: string | null
          event_at?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          is_void?: boolean
          organization_id: string
          raw_label?: string | null
          source_message_id?: string | null
          source_type: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          confirmation_status?: string
          created_at?: string
          description?: string | null
          event_at?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          is_void?: boolean
          organization_id?: string
          raw_label?: string | null
          source_message_id?: string | null
          source_type?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_vehicles: {
        Row: {
          created_at: string
          id: string
          role: string
          source_message_id: string | null
          trip_id: string
          valid_from: string | null
          valid_to: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          source_message_id?: string | null
          trip_id: string
          valid_from?: string | null
          valid_to?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          source_message_id?: string | null
          trip_id?: string
          valid_from?: string | null
          valid_to?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_vehicles_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "line_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_vehicles_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_arrival_at: string | null
          assignment_date: string | null
          carrier_code: string | null
          completed_at: string | null
          confirmation_status: string
          created_at: string
          destination_map_url: string | null
          destination_name: string | null
          destination_province: string | null
          id: string
          latest_status_text: string | null
          manually_overridden_status: string | null
          normalized_shipment_code: string | null
          organization_id: string
          origin_name: string | null
          planned_delivery_at: string | null
          primary_line_group_id: string | null
          shipment_code: string | null
          status: string
          summary_en: string | null
          summary_th: string | null
          updated_at: string
        }
        Insert: {
          actual_arrival_at?: string | null
          assignment_date?: string | null
          carrier_code?: string | null
          completed_at?: string | null
          confirmation_status?: string
          created_at?: string
          destination_map_url?: string | null
          destination_name?: string | null
          destination_province?: string | null
          id?: string
          latest_status_text?: string | null
          manually_overridden_status?: string | null
          normalized_shipment_code?: string | null
          organization_id: string
          origin_name?: string | null
          planned_delivery_at?: string | null
          primary_line_group_id?: string | null
          shipment_code?: string | null
          status?: string
          summary_en?: string | null
          summary_th?: string | null
          updated_at?: string
        }
        Update: {
          actual_arrival_at?: string | null
          assignment_date?: string | null
          carrier_code?: string | null
          completed_at?: string | null
          confirmation_status?: string
          created_at?: string
          destination_map_url?: string | null
          destination_name?: string | null
          destination_province?: string | null
          id?: string
          latest_status_text?: string | null
          manually_overridden_status?: string | null
          normalized_shipment_code?: string | null
          organization_id?: string
          origin_name?: string | null
          planned_delivery_at?: string | null
          primary_line_group_id?: string | null
          shipment_code?: string | null
          status?: string
          summary_en?: string | null
          summary_th?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_primary_line_group_id_fkey"
            columns: ["primary_line_group_id"]
            isOneToOne: false
            referencedRelation: "line_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          registration_display: string
          registration_normalized: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          brand?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          registration_display: string
          registration_normalized: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          brand?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          registration_display?: string
          registration_normalized?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
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
