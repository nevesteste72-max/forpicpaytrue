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
      flow_steps: {
        Row: {
          accept_redirect_url: string | null
          accept_step_id: string | null
          amount: number
          button_accept_color: string | null
          button_accept_text: string | null
          button_decline_color: string | null
          button_decline_text: string | null
          created_at: string
          decline_redirect_url: string | null
          decline_step_id: string | null
          id: string
          image_url: string | null
          page_headline: string | null
          page_subheadline: string | null
          page_url: string | null
          payment_link_id: string
          product_description: string | null
          product_name: string
          show_accept_button: boolean | null
          show_decline_button: boolean | null
          step_order: number
          step_type: string
          updated_at: string
        }
        Insert: {
          accept_redirect_url?: string | null
          accept_step_id?: string | null
          amount: number
          button_accept_color?: string | null
          button_accept_text?: string | null
          button_decline_color?: string | null
          button_decline_text?: string | null
          created_at?: string
          decline_redirect_url?: string | null
          decline_step_id?: string | null
          id?: string
          image_url?: string | null
          page_headline?: string | null
          page_subheadline?: string | null
          page_url?: string | null
          payment_link_id: string
          product_description?: string | null
          product_name: string
          show_accept_button?: boolean | null
          show_decline_button?: boolean | null
          step_order?: number
          step_type?: string
          updated_at?: string
        }
        Update: {
          accept_redirect_url?: string | null
          accept_step_id?: string | null
          amount?: number
          button_accept_color?: string | null
          button_accept_text?: string | null
          button_decline_color?: string | null
          button_decline_text?: string | null
          created_at?: string
          decline_redirect_url?: string | null
          decline_step_id?: string | null
          id?: string
          image_url?: string | null
          page_headline?: string | null
          page_subheadline?: string | null
          page_url?: string | null
          payment_link_id?: string
          product_description?: string | null
          product_name?: string
          show_accept_button?: boolean | null
          show_decline_button?: boolean | null
          step_order?: number
          step_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_steps_accept_step_id_fkey"
            columns: ["accept_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_decline_step_id_fkey"
            columns: ["decline_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          checkout_banner_url: string | null
          checkout_language: string
          checkout_timer_minutes: number | null
          created_at: string
          currency: string
          facebook_pixel_id: string | null
          facebook_token: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          order_bump_id: string | null
          order_bump_name: string | null
          order_bump_price: number | null
          product_description: string | null
          product_name: string
          recovery_cta_text: string | null
          recovery_discount_percent: number | null
          recovery_enabled: boolean
          recovery_headline: string | null
          recovery_message: string | null
          recovery_redirect_url: string | null
          redirect_url: string | null
          stripe_payment_methods: string[]
          thank_you_message: string | null
          thank_you_title: string | null
          thank_you_video_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_banner_url?: string | null
          checkout_language?: string
          checkout_timer_minutes?: number | null
          created_at?: string
          currency?: string
          facebook_pixel_id?: string | null
          facebook_token?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          order_bump_id?: string | null
          order_bump_name?: string | null
          order_bump_price?: number | null
          product_description?: string | null
          product_name: string
          recovery_cta_text?: string | null
          recovery_discount_percent?: number | null
          recovery_enabled?: boolean
          recovery_headline?: string | null
          recovery_message?: string | null
          recovery_redirect_url?: string | null
          redirect_url?: string | null
          stripe_payment_methods?: string[]
          thank_you_message?: string | null
          thank_you_title?: string | null
          thank_you_video_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_banner_url?: string | null
          checkout_language?: string
          checkout_timer_minutes?: number | null
          created_at?: string
          currency?: string
          facebook_pixel_id?: string | null
          facebook_token?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          order_bump_id?: string | null
          order_bump_name?: string | null
          order_bump_price?: number | null
          product_description?: string | null
          product_name?: string
          recovery_cta_text?: string | null
          recovery_discount_percent?: number | null
          recovery_enabled?: boolean
          recovery_headline?: string | null
          recovery_message?: string | null
          recovery_redirect_url?: string | null
          redirect_url?: string | null
          stripe_payment_methods?: string[]
          thank_you_message?: string | null
          thank_you_title?: string | null
          thank_you_video_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string
          created_at: string
          id: string
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          id: string
          payment_link_id: string
          processed_at: string | null
          product_name: string
          reason: string
          reason_details: string | null
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email: string
          customer_name?: string
          id?: string
          payment_link_id: string
          processed_at?: string | null
          product_name: string
          reason: string
          reason_details?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          id?: string
          payment_link_id?: string
          processed_at?: string | null
          product_name?: string
          reason?: string
          reason_details?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          debito_reference: string | null
          flow_step_id: string | null
          id: string
          order_bump_accepted: boolean
          order_bump_amount: number | null
          parent_transaction_id: string | null
          payment_link_id: string
          payment_provider: string
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_method_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email: string
          customer_name?: string
          customer_phone: string
          debito_reference?: string | null
          flow_step_id?: string | null
          id?: string
          order_bump_accepted?: boolean
          order_bump_amount?: number | null
          parent_transaction_id?: string | null
          payment_link_id: string
          payment_provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          debito_reference?: string | null
          flow_step_id?: string | null
          id?: string
          order_bump_accepted?: boolean
          order_bump_amount?: number | null
          parent_transaction_id?: string | null
          payment_link_id?: string
          payment_provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_flow_step_id_fkey"
            columns: ["flow_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          agent_prompt: string | null
          auto_delivery_enabled: boolean | null
          auto_recovery_enabled: boolean | null
          auto_support_enabled: boolean | null
          created_at: string
          id: string
          instance_id: string | null
          instance_name: string
          msg_template_approved: string | null
          msg_template_failed: string | null
          msg_template_pending: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_prompt?: string | null
          auto_delivery_enabled?: boolean | null
          auto_recovery_enabled?: boolean | null
          auto_support_enabled?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name: string
          msg_template_approved?: string | null
          msg_template_failed?: string | null
          msg_template_pending?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_prompt?: string | null
          auto_delivery_enabled?: boolean | null
          auto_recovery_enabled?: boolean | null
          auto_support_enabled?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name?: string
          msg_template_approved?: string | null
          msg_template_failed?: string | null
          msg_template_pending?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          message: string
          message_type: string
          remote_jid: string
          sender: string
          user_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          message: string
          message_type?: string
          remote_jid: string
          sender?: string
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          message?: string
          message_type?: string
          remote_jid?: string
          sender?: string
          user_id?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          phone_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          phone_number: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          phone_number?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
