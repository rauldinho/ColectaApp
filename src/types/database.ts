export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          slug: string;
          code: string;
          admin_token: string;
          name: string;
          description: string | null;
          total_amount: number | null;
          currency: string;
          organizer_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          code: string;
          admin_token?: string;
          name: string;
          description?: string | null;
          total_amount?: number | null;
          currency?: string;
          organizer_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          total_amount?: number | null;
          currency?: string;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      event_items: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          amount?: number;
        };
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          name: string;
          email: string | null;
          amount_owed: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id?: string | null;
          name: string;
          email?: string | null;
          amount_owed: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string | null;
          amount_owed?: number;
        };
      };
      payments: {
        Row: {
          id: string;
          participant_id: string;
          amount: number;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          amount: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
        };
        Update: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
        };
      };
      payment_info: {
        Row: {
          id: string;
          event_id: string;
          bank_name: string | null;
          account_holder: string | null;
          account_number: string | null;
          account_type: string | null;
          rut: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          bank_name?: string | null;
          account_holder?: string | null;
          account_number?: string | null;
          account_type?: string | null;
          rut?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          bank_name?: string | null;
          account_holder?: string | null;
          account_number?: string | null;
          account_type?: string | null;
          rut?: string | null;
          email?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Tipos derivados
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventItem = Database["public"]["Tables"]["event_items"]["Row"];
export type Participant = Database["public"]["Tables"]["participants"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentInfo = Database["public"]["Tables"]["payment_info"]["Row"];

export type EventWithDetails = Event & {
  participants: (Participant & { payments: Payment[] })[];
  event_items: EventItem[];
  payment_info: PaymentInfo | null;
};
