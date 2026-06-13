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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          evidence: string | null
          id: string
          offer_id: string
          opened_by: string
          reason: string
          resolution: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          id?: string
          offer_id: string
          opened_by: string
          reason: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: string | null
          id?: string
          offer_id?: string
          opened_by?: string
          reason?: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: []
      }
      economic_indicators: {
        Row: {
          country_code: string
          created_at: string
          id: string
          indicator: string
          period: string
          source: string | null
          value: number
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          indicator: string
          period: string
          source?: string | null
          value: number
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          indicator?: string
          period?: string
          source?: string | null
          value?: number
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          fn_name: string | null
          id: string
          message: string
          route: string | null
          severity: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          fn_name?: string | null
          id?: string
          message: string
          route?: string | null
          severity?: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          fn_name?: string | null
          id?: string
          message?: string
          route?: string | null
          severity?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      escrow_holds: {
        Row: {
          amount_sar: number
          held_at: string
          id: string
          note: string | null
          offer_id: string
          payee_id: string
          payer_id: string
          released_at: string | null
          status: string
        }
        Insert: {
          amount_sar: number
          held_at?: string
          id?: string
          note?: string | null
          offer_id: string
          payee_id: string
          payer_id: string
          released_at?: string | null
          status?: string
        }
        Update: {
          amount_sar?: number
          held_at?: string
          id?: string
          note?: string | null
          offer_id?: string
          payee_id?: string
          payer_id?: string
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_holds_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "trade_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          age_months: number
          boost_count: number
          category: string
          condition: Database["public"]["Enums"]["listing_condition"]
          created_at: string
          description: string | null
          featured_until: string | null
          id: string
          images: string[]
          is_featured: boolean
          is_pinned: boolean
          is_ribawi: boolean
          last_boosted_at: string | null
          market_price: number
          owner_id: string
          pinned_until: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          wants: string
        }
        Insert: {
          age_months?: number
          boost_count?: number
          category: string
          condition: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description?: string | null
          featured_until?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_pinned?: boolean
          is_ribawi?: boolean
          last_boosted_at?: string | null
          market_price: number
          owner_id: string
          pinned_until?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          wants: string
        }
        Update: {
          age_months?: number
          boost_count?: number
          category?: string
          condition?: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description?: string | null
          featured_until?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_pinned?: boolean
          is_ribawi?: boolean
          last_boosted_at?: string | null
          market_price?: number
          owner_id?: string
          pinned_until?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          wants?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          offer_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          offer_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          offer_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "trade_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          amount_sar: number
          created_at: string
          id: string
          offer_id: string
          paid_at: string | null
          paid_cash_sar: number
          paid_di: number
          payer_id: string
          rate: number
          status: Database["public"]["Enums"]["fee_status"]
        }
        Insert: {
          amount_sar: number
          created_at?: string
          id?: string
          offer_id: string
          paid_at?: string | null
          paid_cash_sar?: number
          paid_di?: number
          payer_id: string
          rate?: number
          status?: Database["public"]["Enums"]["fee_status"]
        }
        Update: {
          amount_sar?: number
          created_at?: string
          id?: string
          offer_id?: string
          paid_at?: string | null
          paid_cash_sar?: number
          paid_di?: number
          payer_id?: string
          rate?: number
          status?: Database["public"]["Enums"]["fee_status"]
        }
        Relationships: []
      }
      price_history: {
        Row: {
          category: string
          id: string
          price: number
          recorded_at: string
          source: string
          title_key: string
        }
        Insert: {
          category: string
          id?: string
          price: number
          recorded_at?: string
          source?: string
          title_key: string
        }
        Update: {
          category?: string
          id?: string
          price?: number
          recorded_at?: string
          source?: string
          title_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          commercial_register: string | null
          company_kyc_doc_url: string | null
          company_kyc_notes: string | null
          company_kyc_status: Database["public"]["Enums"]["kyc_status"]
          company_name: string | null
          company_verified: boolean
          contact_phone: string | null
          created_at: string
          display_name: string
          id: string
          rating: number | null
          terms_accepted_at: string | null
          terms_version: string | null
          trades_count: number | null
          updated_at: string
          verified_badge: boolean
          verified_until: string | null
          whatsapp: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          commercial_register?: string | null
          company_kyc_doc_url?: string | null
          company_kyc_notes?: string | null
          company_kyc_status?: Database["public"]["Enums"]["kyc_status"]
          company_name?: string | null
          company_verified?: boolean
          contact_phone?: string | null
          created_at?: string
          display_name: string
          id: string
          rating?: number | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trades_count?: number | null
          updated_at?: string
          verified_badge?: boolean
          verified_until?: string | null
          whatsapp?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          commercial_register?: string | null
          company_kyc_doc_url?: string | null
          company_kyc_notes?: string | null
          company_kyc_status?: Database["public"]["Enums"]["kyc_status"]
          company_name?: string | null
          company_verified?: boolean
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          id?: string
          rating?: number | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trades_count?: number | null
          updated_at?: string
          verified_badge?: boolean
          verified_until?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          cost_di: number
          created_at: string
          duration_days: number | null
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["promotion_kind"]
          listing_id: string | null
          metadata: Json
          starts_at: string
          user_id: string
        }
        Insert: {
          cost_di: number
          created_at?: string
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["promotion_kind"]
          listing_id?: string | null
          metadata?: Json
          starts_at?: string
          user_id: string
        }
        Update: {
          cost_di?: number
          created_at?: string
          duration_days?: number | null
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["promotion_kind"]
          listing_id?: string | null
          metadata?: Json
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          created_at: string
          id: string
          ip_hash: string | null
          user_id: string | null
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          created_at?: string
          id?: string
          ip_hash?: string | null
          user_id?: string | null
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          ip_hash?: string | null
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          redeemed_at: string | null
          referred_user: string | null
          referrer_id: string
          reward_di: number
          rewarded: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referred_user?: string | null
          referrer_id: string
          reward_di?: number
          rewarded?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referred_user?: string | null
          referrer_id?: string
          reward_di?: number
          rewarded?: boolean
        }
        Relationships: []
      }
      region_settings: {
        Row: {
          cash_only: boolean
          country_code: string
          di_enabled: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          cash_only?: boolean
          country_code: string
          di_enabled?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          cash_only?: boolean
          country_code?: string
          di_enabled?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reserve_snapshots: {
        Row: {
          id: string
          note: string | null
          recorded_at: string
          reserve_ratio: number | null
          reserve_sar: number
          total_di_outstanding: number
        }
        Insert: {
          id?: string
          note?: string | null
          recorded_at?: string
          reserve_ratio?: number | null
          reserve_sar?: number
          total_di_outstanding?: number
        }
        Update: {
          id?: string
          note?: string | null
          recorded_at?: string
          reserve_ratio?: number | null
          reserve_sar?: number
          total_di_outstanding?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          offer_id: string
          rating: number
          reviewed_user: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          offer_id: string
          rating: number
          reviewed_user: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          offer_id?: string
          rating?: number
          reviewed_user?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "trade_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          id: string
          price_sar: number
          renews_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          price_sar?: number
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          price_sar?: number
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_offers: {
        Row: {
          anchor_expires_at: string | null
          anchor_price_sar: number | null
          cash_balance: number | null
          created_at: string
          delivery_confirmed_by_from: boolean
          delivery_confirmed_by_to: boolean
          delivery_proof_url: string | null
          escrow_locked: boolean
          escrow_released_at: string | null
          expected_delivery: string | null
          fairness_score: number | null
          fee_paid_at: string | null
          from_user: string
          id: string
          meetup_at: string | null
          meetup_location: string | null
          message: string | null
          offered_listing: string
          receipt_url: string | null
          requested_listing: string
          shipping_carrier: string | null
          status: Database["public"]["Enums"]["offer_status"]
          to_user: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          anchor_expires_at?: string | null
          anchor_price_sar?: number | null
          cash_balance?: number | null
          created_at?: string
          delivery_confirmed_by_from?: boolean
          delivery_confirmed_by_to?: boolean
          delivery_proof_url?: string | null
          escrow_locked?: boolean
          escrow_released_at?: string | null
          expected_delivery?: string | null
          fairness_score?: number | null
          fee_paid_at?: string | null
          from_user: string
          id?: string
          meetup_at?: string | null
          meetup_location?: string | null
          message?: string | null
          offered_listing: string
          receipt_url?: string | null
          requested_listing: string
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          to_user: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          anchor_expires_at?: string | null
          anchor_price_sar?: number | null
          cash_balance?: number | null
          created_at?: string
          delivery_confirmed_by_from?: boolean
          delivery_confirmed_by_to?: boolean
          delivery_proof_url?: string | null
          escrow_locked?: boolean
          escrow_released_at?: string | null
          expected_delivery?: string | null
          fairness_score?: number | null
          fee_paid_at?: string | null
          from_user?: string
          id?: string
          meetup_at?: string | null
          meetup_location?: string | null
          message?: string | null
          offered_listing?: string
          receipt_url?: string | null
          requested_listing?: string
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          to_user?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_offered_listing_fkey"
            columns: ["offered_listing"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_requested_listing_fkey"
            columns: ["requested_listing"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      vision_usage: {
        Row: {
          created_at: string
          day: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount_di: number
          created_at: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          note: string | null
          reference_offer: string | null
          user_id: string
        }
        Insert: {
          amount_di: number
          created_at?: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          note?: string | null
          reference_offer?: string | null
          user_id: string
        }
        Update: {
          amount_di?: number
          created_at?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          note?: string | null
          reference_offer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wishlist_alerts: {
        Row: {
          created_at: string
          fulfilled: boolean
          fulfilled_at: string | null
          fulfilled_listing_id: string | null
          id: string
          normalized: string
          search_term: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fulfilled?: boolean
          fulfilled_at?: string | null
          fulfilled_listing_id?: string | null
          id?: string
          normalized: string
          search_term: string
          user_id: string
        }
        Update: {
          created_at?: string
          fulfilled?: boolean
          fulfilled_at?: string | null
          fulfilled_listing_id?: string | null
          id?: string
          normalized?: string
          search_term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_alerts_fulfilled_listing_id_fkey"
            columns: ["fulfilled_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      di_balance: { Args: { _user_id: string }; Returns: number }
      expire_promotions: { Args: never; Returns: undefined }
      get_peer_contact: {
        Args: { _offer_id: string }
        Returns: {
          contact_phone: string
          display_name: string
          user_id: string
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pay_platform_fee: {
        Args: { _cash_amount: number; _di_amount: number; _offer_id: string }
        Returns: Json
      }
      purchase_listing_promotion: {
        Args: {
          _duration_days?: number
          _kind: Database["public"]["Enums"]["promotion_kind"]
          _listing_id: string
        }
        Returns: Json
      }
      purchase_subscription: { Args: { _tier: string }; Returns: Json }
      purchase_verification: { Args: never; Returns: Json }
    }
    Enums: {
      account_type: "individual" | "company"
      app_role: "admin" | "moderator" | "user"
      dispute_status: "open" | "under_review" | "resolved" | "rejected"
      fee_status: "due" | "paid" | "waived"
      kyc_status: "none" | "pending" | "verified" | "rejected"
      ledger_entry_type:
        | "welcome_bonus"
        | "trade_completed"
        | "fee_charge"
        | "manual_adjust"
        | "refund"
      listing_condition: "new" | "like-new" | "excellent" | "good" | "fair"
      listing_status: "active" | "pending" | "traded" | "closed"
      offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "completed"
      promotion_kind:
        | "featured"
        | "pinned"
        | "boost"
        | "verify_individual"
        | "sub_merchant"
        | "sub_store"
      subscription_status: "active" | "canceled" | "past_due" | "trialing"
      subscription_tier: "free" | "plus" | "pro" | "merchant" | "store"
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
      account_type: ["individual", "company"],
      app_role: ["admin", "moderator", "user"],
      dispute_status: ["open", "under_review", "resolved", "rejected"],
      fee_status: ["due", "paid", "waived"],
      kyc_status: ["none", "pending", "verified", "rejected"],
      ledger_entry_type: [
        "welcome_bonus",
        "trade_completed",
        "fee_charge",
        "manual_adjust",
        "refund",
      ],
      listing_condition: ["new", "like-new", "excellent", "good", "fair"],
      listing_status: ["active", "pending", "traded", "closed"],
      offer_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "completed",
      ],
      promotion_kind: [
        "featured",
        "pinned",
        "boost",
        "verify_individual",
        "sub_merchant",
        "sub_store",
      ],
      subscription_status: ["active", "canceled", "past_due", "trialing"],
      subscription_tier: ["free", "plus", "pro", "merchant", "store"],
    },
  },
} as const
