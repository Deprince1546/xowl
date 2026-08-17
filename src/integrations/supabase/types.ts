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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_reports: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          payload: Json | null
          risk_score: number | null
          summary: string
          symbol: string | null
          token_address: string
          xowl_score: number | null
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id?: string
          payload?: Json | null
          risk_score?: number | null
          summary: string
          symbol?: string | null
          token_address: string
          xowl_score?: number | null
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          payload?: Json | null
          risk_score?: number | null
          summary?: string
          symbol?: string | null
          token_address?: string
          xowl_score?: number | null
        }
        Relationships: []
      }
      call_snapshots: {
        Row: {
          call_id: string
          captured_at: string
          id: string
          market_cap: number | null
          multiplier: number | null
          price: number | null
        }
        Insert: {
          call_id: string
          captured_at?: string
          id?: string
          market_cap?: number | null
          multiplier?: number | null
          price?: number | null
        }
        Update: {
          call_id?: string
          captured_at?: string
          id?: string
          market_cap?: number | null
          multiplier?: number | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_snapshots_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          ath_market_cap: number | null
          ath_multiplier: number | null
          call_market_cap: number | null
          call_price: number | null
          called_at: string
          confidence: number
          current_multiplier: number | null
          decision: string
          id: string
          reasoning: string | null
          risk_score: number
          smart_money_score: number
          status: string
          symbol: string
          token_address: string
          updated_at: string
          xowl_score: number
        }
        Insert: {
          ath_market_cap?: number | null
          ath_multiplier?: number | null
          call_market_cap?: number | null
          call_price?: number | null
          called_at?: string
          confidence?: number
          current_multiplier?: number | null
          decision?: string
          id?: string
          reasoning?: string | null
          risk_score?: number
          smart_money_score?: number
          status?: string
          symbol: string
          token_address: string
          updated_at?: string
          xowl_score?: number
        }
        Update: {
          ath_market_cap?: number | null
          ath_multiplier?: number | null
          call_market_cap?: number | null
          call_price?: number | null
          called_at?: string
          confidence?: number
          current_multiplier?: number | null
          decision?: string
          id?: string
          reasoning?: string | null
          risk_score?: number
          smart_money_score?: number
          status?: string
          symbol?: string
          token_address?: string
          updated_at?: string
          xowl_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "calls_token_address_fkey"
            columns: ["token_address"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["address"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          call_id: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          call_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          call_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      tokens: {
        Row: {
          address: string
          created_at: string
          decimals: number | null
          dex_id: string | null
          first_seen_at: string
          name: string | null
          pair_address: string | null
          symbol: string
        }
        Insert: {
          address: string
          created_at?: string
          decimals?: number | null
          dex_id?: string | null
          first_seen_at?: string
          name?: string | null
          pair_address?: string | null
          symbol: string
        }
        Update: {
          address?: string
          created_at?: string
          decimals?: number | null
          dex_id?: string | null
          first_seen_at?: string
          name?: string | null
          pair_address?: string | null
          symbol?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          amount_okb: number
          call_id: string | null
          created_at: string
          entry_price: number | null
          exit_price: number | null
          id: string
          max_slippage: number
          note: string | null
          realized_multiplier: number | null
          status: string
          symbol: string
          target_multiplier: number
          token_address: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount_okb: number
          call_id?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          max_slippage?: number
          note?: string | null
          realized_multiplier?: number | null
          status?: string
          symbol: string
          target_multiplier?: number
          token_address: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount_okb?: number
          call_id?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          max_slippage?: number
          note?: string | null
          realized_multiplier?: number | null
          status?: string
          symbol?: string
          target_multiplier?: number
          token_address?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          symbol: string | null
          token_address: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          symbol?: string | null
          token_address: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          symbol?: string | null
          token_address?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
