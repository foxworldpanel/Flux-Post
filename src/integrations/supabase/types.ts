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
      campaigns: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          max_interval_minutes: number | null
          min_interval_minutes: number | null
          music_id: string | null
          name: string
          posts_per_day_per_account: number | null
          start_date: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          max_interval_minutes?: number | null
          min_interval_minutes?: number | null
          music_id?: string | null
          name: string
          posts_per_day_per_account?: number | null
          start_date?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          max_interval_minutes?: number | null
          min_interval_minutes?: number | null
          music_id?: string | null
          name?: string
          posts_per_day_per_account?: number | null
          start_date?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_music_id_fkey"
            columns: ["music_id"]
            isOneToOne: false
            referencedRelation: "musics"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          hora_fim: number | null
          hora_inicio: number | null
          id: string
          intervalo_max: number | null
          intervalo_min: number | null
          music_track_id: string | null
          nome: string
          posts_por_dia: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          hora_fim?: number | null
          hora_inicio?: number | null
          id?: string
          intervalo_max?: number | null
          intervalo_min?: number | null
          music_track_id?: string | null
          nome: string
          posts_por_dia?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          hora_fim?: number | null
          hora_inicio?: number | null
          id?: string
          intervalo_max?: number | null
          intervalo_min?: number | null
          music_track_id?: string | null
          nome?: string
          posts_por_dia?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tracks: {
        Row: {
          artista: string | null
          campanha_ativa: boolean | null
          criado_em: string | null
          duracao_segundos: number | null
          estilo: string | null
          id: string
          nome: string
          storage_path: string | null
          user_id: string | null
          vezes_usada: number | null
        }
        Insert: {
          artista?: string | null
          campanha_ativa?: boolean | null
          criado_em?: string | null
          duracao_segundos?: number | null
          estilo?: string | null
          id?: string
          nome: string
          storage_path?: string | null
          user_id?: string | null
          vezes_usada?: number | null
        }
        Update: {
          artista?: string | null
          campanha_ativa?: boolean | null
          criado_em?: string | null
          duracao_segundos?: number | null
          estilo?: string | null
          id?: string
          nome?: string
          storage_path?: string | null
          user_id?: string | null
          vezes_usada?: number | null
        }
        Relationships: []
      }
      musics: {
        Row: {
          artist: string | null
          created_at: string
          duration_seconds: number | null
          genre: string | null
          id: string
          music_url: string
          name: string
          use_count: number | null
          user_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          music_url: string
          name: string
          use_count?: number | null
          user_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          music_url?: string
          name?: string
          use_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      posts_agendados: {
        Row: {
          agendado_para: string | null
          campanha_id: string | null
          criado_em: string | null
          hashtags: string[] | null
          id: string
          legenda: string | null
          music_track_id: string | null
          postado_em: string | null
          status: string | null
          tiktok_account_id: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          agendado_para?: string | null
          campanha_id?: string | null
          criado_em?: string | null
          hashtags?: string[] | null
          id?: string
          legenda?: string | null
          music_track_id?: string | null
          postado_em?: string | null
          status?: string | null
          tiktok_account_id?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          agendado_para?: string | null
          campanha_id?: string | null
          criado_em?: string | null
          hashtags?: string[] | null
          id?: string
          legenda?: string | null
          music_track_id?: string | null
          postado_em?: string | null
          status?: string | null
          tiktok_account_id?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_agendados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_agendados_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_agendados_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_agendados_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          account_id: string
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          music_id: string
          scheduled_at: string
          status: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          account_id: string
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          music_id: string
          scheduled_at: string
          status?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          account_id?: string
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          music_id?: string
          scheduled_at?: string
          status?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_music_id_fkey"
            columns: ["music_id"]
            isOneToOne: false
            referencedRelation: "musics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          next_post_at: string | null
          posts_hoje: number | null
          status: string | null
          total_posts: number | null
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          next_post_at?: string | null
          posts_hoje?: number | null
          status?: string | null
          total_posts?: number | null
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          next_post_at?: string | null
          posts_hoje?: number | null
          status?: string | null
          total_posts?: number | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          criado_em: string | null
          duracao_segundos: number | null
          id: string
          nicho: string | null
          nome: string | null
          storage_path: string | null
          ultimo_uso: string | null
          vezes_usada: number | null
        }
        Insert: {
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          nicho?: string | null
          nome?: string | null
          storage_path?: string | null
          ultimo_uso?: string | null
          vezes_usada?: number | null
        }
        Update: {
          criado_em?: string | null
          duracao_segundos?: number | null
          id?: string
          nicho?: string | null
          nome?: string | null
          storage_path?: string | null
          ultimo_uso?: string | null
          vezes_usada?: number | null
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
