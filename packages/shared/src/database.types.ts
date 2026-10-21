export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_suspensions: {
        Row: {
          reason: string;
          suspended_at: string;
          suspended_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          reason: string;
          suspended_at?: string;
          suspended_by?: string | null;
          user_id: string;
        };
        Update: {
          reason?: string;
          suspended_at?: string;
          suspended_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_suspensions_suspended_by_fkey";
            columns: ["suspended_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_suspensions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string;
          entity_type?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_specialties: {
        Row: {
          business_id: string;
          specialty_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          specialty_id: string;
        };
        Update: {
          business_id?: string;
          specialty_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_specialties_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_specialties_specialty_id_fkey";
            columns: ["specialty_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          city: string;
          created_at: string;
          description: string | null;
          district: string | null;
          email: string | null;
          id: string;
          kind: Database["public"]["Enums"]["business_kind"];
          latitude: number | null;
          location: unknown;
          longitude: number | null;
          name: string;
          owner_id: string;
          phone: string | null;
          phone_is_whatsapp: boolean;
          postal_code: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          state: string;
          status: Database["public"]["Enums"]["business_status"];
          street: string | null;
          street_number: string | null;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          city: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          email?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["business_kind"];
          latitude?: never;
          location?: unknown;
          longitude?: never;
          name: string;
          owner_id?: string;
          phone?: string | null;
          phone_is_whatsapp?: boolean;
          postal_code?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state: string;
          status?: Database["public"]["Enums"]["business_status"];
          street?: string | null;
          street_number?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          city?: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          email?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["business_kind"];
          latitude?: never;
          location?: unknown;
          longitude?: never;
          name?: string;
          owner_id?: string;
          phone?: string | null;
          phone_is_whatsapp?: boolean;
          postal_code?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state?: string;
          status?: Database["public"]["Enums"]["business_status"];
          street?: string | null;
          street_number?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "businesses_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      coupons: {
        Row: {
          code: string;
          expires_at: string;
          id: string;
          issued_at: string;
          offer_id: string;
          redeemed_at: string | null;
          status: Database["public"]["Enums"]["coupon_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          expires_at: string;
          id?: string;
          issued_at?: string;
          offer_id: string;
          redeemed_at?: string | null;
          status?: Database["public"]["Enums"]["coupon_status"];
          user_id: string;
        };
        Update: {
          code?: string;
          expires_at?: string;
          id?: string;
          issued_at?: string;
          offer_id?: string;
          redeemed_at?: string | null;
          status?: Database["public"]["Enums"]["coupon_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coupons_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credentials: {
        Row: {
          business_id: string;
          created_at: string;
          document_path: string;
          expires_on: string | null;
          id: string;
          issued_on: string | null;
          issuer: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          specialty_id: string | null;
          status: Database["public"]["Enums"]["credential_status"];
          title: string;
          type: Database["public"]["Enums"]["credential_type"];
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          created_at?: string;
          document_path: string;
          expires_on?: string | null;
          id?: string;
          issued_on?: string | null;
          issuer?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          specialty_id?: string | null;
          status?: Database["public"]["Enums"]["credential_status"];
          title: string;
          type: Database["public"]["Enums"]["credential_type"];
        };
        Update: {
          business_id?: string;
          created_at?: string;
          document_path?: string;
          expires_on?: string | null;
          id?: string;
          issued_on?: string | null;
          issuer?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          specialty_id?: string | null;
          status?: Database["public"]["Enums"]["credential_status"];
          title?: string;
          type?: Database["public"]["Enums"]["credential_type"];
        };
        Relationships: [
          {
            foreignKeyName: "credentials_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credentials_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credentials_specialty_id_fkey";
            columns: ["specialty_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id"];
          },
        ];
      };
      ephemeral_presence: {
        Row: {
          cell_lat: number;
          cell_lng: number;
          expires_at: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cell_lat: number;
          cell_lng: number;
          expires_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cell_lat?: number;
          cell_lng?: number;
          expires_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ephemeral_presence_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendees: {
        Row: {
          created_at: string;
          event_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          attendee_count: number;
          business_id: string | null;
          capacity: number | null;
          city: string;
          created_at: string;
          description: string | null;
          district: string | null;
          ends_at: string;
          id: string;
          kind: Database["public"]["Enums"]["event_kind"];
          latitude: number | null;
          location: unknown;
          longitude: number | null;
          organizer_id: string;
          starts_at: string;
          state: string;
          status: Database["public"]["Enums"]["event_status"];
          status_note: string | null;
          street: string | null;
          street_number: string | null;
          title: string;
          updated_at: string;
          venue_name: string;
        };
        ComputedFields: never;
        Insert: {
          attendee_count?: number;
          business_id?: string | null;
          capacity?: number | null;
          city: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          ends_at: string;
          id?: string;
          kind: Database["public"]["Enums"]["event_kind"];
          latitude?: never;
          location?: unknown;
          longitude?: never;
          organizer_id?: string;
          starts_at: string;
          state: string;
          status?: Database["public"]["Enums"]["event_status"];
          status_note?: string | null;
          street?: string | null;
          street_number?: string | null;
          title: string;
          updated_at?: string;
          venue_name: string;
        };
        Update: {
          attendee_count?: number;
          business_id?: string | null;
          capacity?: number | null;
          city?: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          ends_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["event_kind"];
          latitude?: never;
          location?: unknown;
          longitude?: never;
          organizer_id?: string;
          starts_at?: string;
          state?: string;
          status?: Database["public"]["Enums"]["event_status"];
          status_note?: string | null;
          street?: string | null;
          street_number?: string | null;
          title?: string;
          updated_at?: string;
          venue_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["friendship_status"];
        };
        ComputedFields: never;
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["friendship_status"];
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["friendship_status"];
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      location_session_recipients: {
        Row: {
          recipient_id: string;
          session_id: string;
        };
        ComputedFields: never;
        Insert: {
          recipient_id: string;
          session_id: string;
        };
        Update: {
          recipient_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_session_recipients_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_session_recipients_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "location_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      location_sessions: {
        Row: {
          accuracy_m: number | null;
          expires_at: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          owner_id: string;
          position_at: string | null;
          purpose: Database["public"]["Enums"]["location_purpose"];
          purpose_note: string | null;
          revoked_at: string | null;
          started_at: string;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          expires_at: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          owner_id: string;
          position_at?: string | null;
          purpose: Database["public"]["Enums"]["location_purpose"];
          purpose_note?: string | null;
          revoked_at?: string | null;
          started_at?: string;
        };
        Update: {
          accuracy_m?: number | null;
          expires_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          owner_id?: string;
          position_at?: string | null;
          purpose?: Database["public"]["Enums"]["location_purpose"];
          purpose_note?: string | null;
          revoked_at?: string | null;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_sessions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      offers: {
        Row: {
          business_id: string;
          created_at: string;
          description: string | null;
          discount_label: string;
          ends_at: string;
          id: string;
          issued_count: number;
          max_redemptions: number | null;
          per_user_limit: number;
          starts_at: string;
          status: Database["public"]["Enums"]["offer_status"];
          terms: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          created_at?: string;
          description?: string | null;
          discount_label: string;
          ends_at: string;
          id?: string;
          issued_count?: number;
          max_redemptions?: number | null;
          per_user_limit?: number;
          starts_at?: string;
          status?: Database["public"]["Enums"]["offer_status"];
          terms?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          description?: string | null;
          discount_label?: string;
          ends_at?: string;
          id?: string;
          issued_count?: number;
          max_redemptions?: number | null;
          per_user_limit?: number;
          starts_at?: string;
          status?: Database["public"]["Enums"]["offer_status"];
          terms?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "offers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          city: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          state: string | null;
          updated_at: string;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          state?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          state?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          name: string;
          sort?: number;
        };
        Update: {
          id?: string;
          name?: string;
          sort?: number;
        };
        Relationships: [];
      };
      vehicle_photos: {
        Row: {
          created_at: string;
          id: string;
          storage_path: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          storage_path: string;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          storage_path?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_private: {
        Row: {
          plate: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          plate?: string | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          plate?: string | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_private_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          created_at: string;
          id: string;
          make: string;
          model: string;
          nickname: string | null;
          owner_id: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["vehicle_visibility"];
          year: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          make: string;
          model: string;
          nickname?: string | null;
          owner_id?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["vehicle_visibility"];
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          make?: string;
          model?: string;
          nickname?: string | null;
          owner_id?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["vehicle_visibility"];
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_list_reports: {
        Args: { p_limit?: number; p_status?: Database["public"]["Enums"]["report_status"] };
        Returns: {
          created_at: string;
          details: string;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_username: string;
          resolution_note: string;
          same_target_open: number;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        }[];
      };
      admin_list_suspensions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          display_name: string;
          reason: string;
          suspended_at: string;
          suspended_by_username: string;
          user_id: string;
          username: string;
        }[];
      };
      admin_suspend_user: { Args: { p_reason: string; p_user_id: string }; Returns: undefined };
      admin_unsuspend_user: { Args: { p_note: string; p_user_id: string }; Returns: undefined };
      block_user: { Args: { p_user_id: string }; Returns: undefined };
      cancel_coupon: { Args: { p_coupon_id: string }; Returns: undefined };
      cancel_event: { Args: { p_event_id: string; p_note?: string }; Returns: undefined };
      claim_offer: {
        Args: { p_offer_id: string };
        Returns: {
          code: string;
          coupon_id: string;
          expires_at: string;
        }[];
      };
      clear_presence: { Args: Record<PropertyKey, never>; Returns: undefined };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      delete_my_account: { Args: { p_confirmation: string }; Returns: undefined };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      get_business_credentials: {
        Args: { p_business_id: string };
        Returns: {
          created_at: string;
          document_path: string;
          expires_on: string;
          id: string;
          issued_on: string;
          issuer: string;
          review_note: string;
          reviewed_at: string;
          specialty_id: string;
          status: Database["public"]["Enums"]["credential_status"];
          title: string;
          type: Database["public"]["Enums"]["credential_type"];
        }[];
      };
      get_business_review: {
        Args: { p_business_id: string };
        Returns: {
          review_note: string;
          reviewed_at: string;
          status: Database["public"]["Enums"]["business_status"];
        }[];
      };
      get_event_attendees: {
        Args: { p_event_id: string };
        Returns: {
          confirmed_at: string;
          display_name: string;
          user_id: string;
          username: string;
        }[];
      };
      moderate_hide_vehicle: { Args: { p_note: string; p_vehicle_id: string }; Returns: undefined };
      my_blocks: {
        Args: Record<PropertyKey, never>;
        Returns: {
          blocked_at: string;
          display_name: string;
          user_id: string;
          username: string;
        }[];
      };
      my_friendships: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          display_name: string;
          friendship_id: string;
          incoming: boolean;
          other_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
          username: string;
        }[];
      };
      my_location_session: {
        Args: Record<PropertyKey, never>;
        Returns: {
          expires_at: string;
          id: string;
          position_at: string;
          purpose: Database["public"]["Enums"]["location_purpose"];
          purpose_note: string;
          recipients: Json;
          started_at: string;
        }[];
      };
      nearby_friends: {
        Args: { p_latitude: number; p_longitude: number };
        Returns: {
          display_name: string;
          distance_band: string;
          until: string;
          user_id: string;
          username: string;
        }[];
      };
      redeem_coupon: {
        Args: { p_code: string };
        Returns: {
          coupon_id: string;
          discount_label: string;
          offer_title: string;
          redeemed_at: string;
        }[];
      };
      remove_event: { Args: { p_event_id: string; p_note: string }; Returns: undefined };
      resolve_report: {
        Args: {
          p_note?: string;
          p_report_id: string;
          p_status: Database["public"]["Enums"]["report_status"];
        };
        Returns: undefined;
      };
      respond_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string };
        Returns: undefined;
      };
      review_business: {
        Args: {
          p_business_id: string;
          p_decision: Database["public"]["Enums"]["business_status"];
          p_note?: string;
        };
        Returns: undefined;
      };
      review_credential: {
        Args: {
          p_credential_id: string;
          p_decision: Database["public"]["Enums"]["credential_status"];
          p_note?: string;
        };
        Returns: undefined;
      };
      rsvp_event: { Args: { p_event_id: string }; Returns: number };
      search_nearby_businesses: {
        Args: {
          p_kind?: Database["public"]["Enums"]["business_kind"];
          p_latitude: number;
          p_limit?: number;
          p_longitude: number;
          p_radius_km?: number;
          p_specialty?: string;
        };
        Returns: {
          city: string;
          distance_m: number;
          id: string;
          kind: Database["public"]["Enums"]["business_kind"];
          latitude: number;
          longitude: number;
          name: string;
          specialty_ids: string[];
          state: string;
        }[];
      };
      search_profiles: {
        Args: { p_query: string };
        Returns: {
          city: string;
          display_name: string;
          id: string;
          state: string;
          username: string;
        }[];
      };
      send_friend_request: {
        Args: { p_user_id: string };
        Returns: Database["public"]["Enums"]["friendship_status"];
      };
      set_business_location: {
        Args: { p_business_id: string; p_latitude?: number; p_longitude?: number };
        Returns: undefined;
      };
      set_event_location: {
        Args: { p_event_id: string; p_latitude?: number; p_longitude?: number };
        Returns: undefined;
      };
      set_presence: {
        Args: { p_latitude: number; p_longitude: number; p_minutes?: number };
        Returns: string;
      };
      set_user_role: {
        Args: { new_role: Database["public"]["Enums"]["app_role"]; target_user_id: string };
        Returns: undefined;
      };
      shared_locations_for_me: {
        Args: Record<PropertyKey, never>;
        Returns: {
          accuracy_m: number;
          display_name: string;
          expires_at: string;
          latitude: number;
          longitude: number;
          owner_id: string;
          position_at: string;
          purpose: Database["public"]["Enums"]["location_purpose"];
          purpose_note: string;
          session_id: string;
          username: string;
        }[];
      };
      start_location_session: {
        Args: {
          p_minutes: number;
          p_note?: string;
          p_purpose: Database["public"]["Enums"]["location_purpose"];
          p_recipient_ids: string[];
        };
        Returns: string;
      };
      stop_location_session: { Args: { p_session_id: string }; Returns: undefined };
      unblock_user: { Args: { p_user_id: string }; Returns: undefined };
      update_session_location: {
        Args: {
          p_accuracy_m?: number;
          p_latitude: number;
          p_longitude: number;
          p_session_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "user" | "admin";
      business_kind:
        "workshop" | "mechanic" | "tuner" | "gas_station" | "parts_store" | "detailing";
      business_status: "pending" | "approved" | "rejected" | "suspended";
      coupon_status: "issued" | "redeemed" | "cancelled";
      credential_status: "pending" | "approved" | "rejected";
      credential_type: "business_registration" | "certification" | "training" | "other";
      event_kind:
        "meetup" | "exhibition" | "cruise" | "track_day" | "workshop" | "charity" | "other";
      event_status: "scheduled" | "cancelled" | "removed";
      friendship_status: "pending" | "accepted";
      location_purpose: "meetup" | "convoy" | "safety" | "other";
      offer_status: "active" | "paused";
      report_reason: "spam" | "offensive" | "fraud" | "dangerous_driving" | "privacy" | "other";
      report_status: "open" | "resolved" | "dismissed";
      report_target: "profile" | "vehicle" | "business" | "event" | "offer";
      vehicle_visibility: "public" | "private";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin"],
      business_kind: ["workshop", "mechanic", "tuner", "gas_station", "parts_store", "detailing"],
      business_status: ["pending", "approved", "rejected", "suspended"],
      coupon_status: ["issued", "redeemed", "cancelled"],
      credential_status: ["pending", "approved", "rejected"],
      credential_type: ["business_registration", "certification", "training", "other"],
      event_kind: ["meetup", "exhibition", "cruise", "track_day", "workshop", "charity", "other"],
      event_status: ["scheduled", "cancelled", "removed"],
      friendship_status: ["pending", "accepted"],
      location_purpose: ["meetup", "convoy", "safety", "other"],
      offer_status: ["active", "paused"],
      report_reason: ["spam", "offensive", "fraud", "dangerous_driving", "privacy", "other"],
      report_status: ["open", "resolved", "dismissed"],
      report_target: ["profile", "vehicle", "business", "event", "offer"],
      vehicle_visibility: ["public", "private"],
    },
  },
} as const;
