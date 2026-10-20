export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
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
      set_business_location: {
        Args: { p_business_id: string; p_latitude?: number; p_longitude?: number };
        Returns: undefined;
      };
      set_user_role: {
        Args: { new_role: Database["public"]["Enums"]["app_role"]; target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "user" | "admin";
      business_kind:
        "workshop" | "mechanic" | "tuner" | "gas_station" | "parts_store" | "detailing";
      business_status: "pending" | "approved" | "rejected" | "suspended";
      credential_status: "pending" | "approved" | "rejected";
      credential_type: "business_registration" | "certification" | "training" | "other";
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
      credential_status: ["pending", "approved", "rejected"],
      credential_type: ["business_registration", "certification", "training", "other"],
      vehicle_visibility: ["public", "private"],
    },
  },
} as const;
