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
      artists: {
        Row: {
          ai_briefing: string | null
          blocked_hashtags: string[] | null
          communication_identity: string | null
          created_at: string | null
          description: string | null
          genre: string | null
          id: string
          name: string
          photo_url: string | null
          primary_language: string | null
          priority_hashtags: string[] | null
          priority_markets: string[] | null
          slug: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_briefing?: string | null
          blocked_hashtags?: string[] | null
          communication_identity?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          name: string
          photo_url?: string | null
          primary_language?: string | null
          priority_hashtags?: string[] | null
          priority_markets?: string[] | null
          slug: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_briefing?: string | null
          blocked_hashtags?: string[] | null
          communication_identity?: string | null
          created_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          primary_language?: string | null
          priority_hashtags?: string[] | null
          priority_markets?: string[] | null
          slug?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_contents: {
        Row: {
          campaign_id: string
          content_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          campaign_id: string
          content_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          campaign_id?: string
          content_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_social_accounts: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          social_account_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          social_account_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          social_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_social_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_social_accounts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
          artist_id: string | null
          audio_mode: string | null
          batch_interval_minutes: number | null
          content_interval_minutes: number | null
          cooldown_days: number | null
          criado_em: string | null
          daily_end_time: string | null
          daily_start_time: string | null
          data_fim: string | null
          data_inicio: string | null
          destination_interval_seconds: number | null
          distribution_mode: string | null
          distribution_variation: string | null
          editorial_language: string | null
          editorial_style: string | null
          hora_fim: number | null
          hora_inicio: number | null
          id: string
          intervalo_max: number | null
          intervalo_min: number | null
          music_start_mode: string | null
          music_start_ms: number | null
          music_track_id: string | null
          music_volume: number | null
          nome: string
          original_audio_volume: number | null
          posts_per_day: number | null
          posts_por_dia: number | null
          repeat_cooldown_days: number | null
          repeat_policy: string | null
          schedule_mode: string | null
          start_mode: string | null
          status: string | null
          timezone: string | null
          user_id: string | null
          variation_level: string | null
        }
        Insert: {
          artist_id?: string | null
          audio_mode?: string | null
          batch_interval_minutes?: number | null
          content_interval_minutes?: number | null
          cooldown_days?: number | null
          criado_em?: string | null
          daily_end_time?: string | null
          daily_start_time?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          destination_interval_seconds?: number | null
          distribution_mode?: string | null
          distribution_variation?: string | null
          editorial_language?: string | null
          editorial_style?: string | null
          hora_fim?: number | null
          hora_inicio?: number | null
          id?: string
          intervalo_max?: number | null
          intervalo_min?: number | null
          music_start_mode?: string | null
          music_start_ms?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          nome: string
          original_audio_volume?: number | null
          posts_per_day?: number | null
          posts_por_dia?: number | null
          repeat_cooldown_days?: number | null
          repeat_policy?: string | null
          schedule_mode?: string | null
          start_mode?: string | null
          status?: string | null
          timezone?: string | null
          user_id?: string | null
          variation_level?: string | null
        }
        Update: {
          artist_id?: string | null
          audio_mode?: string | null
          batch_interval_minutes?: number | null
          content_interval_minutes?: number | null
          cooldown_days?: number | null
          criado_em?: string | null
          daily_end_time?: string | null
          daily_start_time?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          destination_interval_seconds?: number | null
          distribution_mode?: string | null
          distribution_variation?: string | null
          editorial_language?: string | null
          editorial_style?: string | null
          hora_fim?: number | null
          hora_inicio?: number | null
          id?: string
          intervalo_max?: number | null
          intervalo_min?: number | null
          music_start_mode?: string | null
          music_start_ms?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          nome?: string
          original_audio_volume?: number | null
          posts_per_day?: number | null
          posts_por_dia?: number | null
          repeat_cooldown_days?: number | null
          repeat_policy?: string | null
          schedule_mode?: string | null
          start_mode?: string | null
          status?: string | null
          timezone?: string | null
          user_id?: string | null
          variation_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      content_candidates: {
        Row: {
          author: string | null
          category: string | null
          discovered_at: string | null
          duration: number | null
          external_id: string
          height: number | null
          id: string
          metadata: Json | null
          orientation: string | null
          original_url: string | null
          preview_url: string | null
          reviewed_at: string | null
          search_term: string | null
          source: string
          status: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          discovered_at?: string | null
          duration?: number | null
          external_id: string
          height?: number | null
          id?: string
          metadata?: Json | null
          orientation?: string | null
          original_url?: string | null
          preview_url?: string | null
          reviewed_at?: string | null
          search_term?: string | null
          source?: string
          status?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          author?: string | null
          category?: string | null
          discovered_at?: string | null
          duration?: number | null
          external_id?: string
          height?: number | null
          id?: string
          metadata?: Json | null
          orientation?: string | null
          original_url?: string | null
          preview_url?: string | null
          reviewed_at?: string | null
          search_term?: string | null
          source?: string
          status?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      content_discovery_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          search_terms: string[] | null
          target_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          search_terms?: string[] | null
          target_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          search_terms?: string[] | null
          target_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_discovery_settings: {
        Row: {
          default_orientation: string | null
          id: string
          is_active: boolean | null
          max_duration: number | null
          max_per_execution: number | null
          min_duration: number | null
          target_stock: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          default_orientation?: string | null
          id?: string
          is_active?: boolean | null
          max_duration?: number | null
          max_per_execution?: number | null
          min_duration?: number | null
          target_stock?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          default_orientation?: string | null
          id?: string
          is_active?: boolean | null
          max_duration?: number | null
          max_per_execution?: number | null
          min_duration?: number | null
          target_stock?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_library: {
        Row: {
          artist_id: string | null
          author: string | null
          category: string | null
          created_at: string | null
          credit: string | null
          duration_seconds: number | null
          external_id: string | null
          file_type: string | null
          first_used_at: string | null
          id: string
          last_used_at: string | null
          license_info: string | null
          niche: string | null
          orientation: string | null
          original_url: string | null
          performance_score: number | null
          source: string | null
          status: string | null
          storage_path: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          use_count: number | null
          user_id: string | null
        }
        Insert: {
          artist_id?: string | null
          author?: string | null
          category?: string | null
          created_at?: string | null
          credit?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          file_type?: string | null
          first_used_at?: string | null
          id?: string
          last_used_at?: string | null
          license_info?: string | null
          niche?: string | null
          orientation?: string | null
          original_url?: string | null
          performance_score?: number | null
          source?: string | null
          status?: string | null
          storage_path: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Update: {
          artist_id?: string | null
          author?: string | null
          category?: string | null
          created_at?: string | null
          credit?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          file_type?: string | null
          first_used_at?: string | null
          id?: string
          last_used_at?: string | null
          license_info?: string | null
          niche?: string | null
          orientation?: string | null
          original_url?: string | null
          performance_score?: number | null
          source?: string | null
          status?: string | null
          storage_path?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_library_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      media_renders: {
        Row: {
          attempts: number | null
          audio_mode: string | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          file_size: number | null
          id: string
          is_approved: boolean | null
          last_heartbeat: string | null
          max_attempts: number | null
          music_start_ms: number | null
          music_track_id: string | null
          music_volume: number | null
          original_audio_volume: number | null
          output_profile: string | null
          render_key: string
          render_options: Json | null
          source_content_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["render_status"]
          storage_path: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          audio_mode?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_size?: number | null
          id?: string
          is_approved?: boolean | null
          last_heartbeat?: string | null
          max_attempts?: number | null
          music_start_ms?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          original_audio_volume?: number | null
          output_profile?: string | null
          render_key: string
          render_options?: Json | null
          source_content_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["render_status"]
          storage_path?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          audio_mode?: string | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          file_size?: number | null
          id?: string
          is_approved?: boolean | null
          last_heartbeat?: string | null
          max_attempts?: number | null
          music_start_ms?: number | null
          music_track_id?: string | null
          music_volume?: number | null
          original_audio_volume?: number | null
          output_profile?: string | null
          render_key?: string
          render_options?: Json | null
          source_content_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["render_status"]
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_renders_music_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_renders_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tracks: {
        Row: {
          artist_id: string | null
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
          artist_id?: string | null
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
          artist_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "music_tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
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
      publication_metrics: {
        Row: {
          collected_at: string | null
          comments: number | null
          engagement_rate: number | null
          id: string
          likes: number | null
          publication_id: string | null
          shares: number | null
          views: number | null
          watch_time_avg: number | null
          watch_time_total: number | null
        }
        Insert: {
          collected_at?: string | null
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          publication_id?: string | null
          shares?: number | null
          views?: number | null
          watch_time_avg?: number | null
          watch_time_total?: number | null
        }
        Update: {
          collected_at?: string | null
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          publication_id?: string | null
          shares?: number | null
          views?: number | null
          watch_time_avg?: number | null
          watch_time_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_metrics_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          attempts: number | null
          campaign_id: string | null
          caption: string | null
          content_id: string | null
          created_at: string | null
          hashtags: string[] | null
          id: string
          last_error: string | null
          media_render_id: string | null
          metadata: Json | null
          music_track_id: string | null
          platform: string
          post_url: string | null
          provider_connection_id: string | null
          provider_post_id: string | null
          published_at: string | null
          render_options: Json | null
          scheduled_for: string | null
          social_account_id: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          campaign_id?: string | null
          caption?: string | null
          content_id?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          last_error?: string | null
          media_render_id?: string | null
          metadata?: Json | null
          music_track_id?: string | null
          platform: string
          post_url?: string | null
          provider_connection_id?: string | null
          provider_post_id?: string | null
          published_at?: string | null
          render_options?: Json | null
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          campaign_id?: string | null
          caption?: string | null
          content_id?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          last_error?: string | null
          media_render_id?: string | null
          metadata?: Json | null
          music_track_id?: string | null
          platform?: string
          post_url?: string | null
          provider_connection_id?: string | null
          provider_post_id?: string | null
          published_at?: string | null
          render_options?: Json | null
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_publications_music_track_id"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_publications_social_account"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_media_render_id_fkey"
            columns: ["media_render_id"]
            isOneToOne: false
            referencedRelation: "media_renders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      server_cron_state: {
        Row: {
          executor_type: string | null
          id: string
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          next_expected_run_at: string | null
          next_run: string | null
          processed_count: number | null
          status: string | null
        }
        Insert: {
          executor_type?: string | null
          id: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          next_expected_run_at?: string | null
          next_run?: string | null
          processed_count?: number | null
          status?: string | null
        }
        Update: {
          executor_type?: string | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          next_expected_run_at?: string | null
          next_run?: string | null
          processed_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      server_tasks: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          scheduled_for: string | null
          status: string | null
          task_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          scheduled_for?: string | null
          status?: string | null
          task_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          scheduled_for?: string | null
          status?: string | null
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_account_credentials: {
        Row: {
          access_token_encrypted: string
          access_token_expires_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          provider: string
          refresh_token_encrypted: string | null
          refresh_token_expires_at: string | null
          scopes: string[] | null
          social_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          access_token_expires_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          refresh_token_encrypted?: string | null
          refresh_token_expires_at?: string | null
          scopes?: string[] | null
          social_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          access_token_expires_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          refresh_token_encrypted?: string | null
          refresh_token_expires_at?: string | null
          scopes?: string[] | null
          social_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_account_credentials_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_name: string | null
          artist_id: string | null
          avatar_url: string | null
          connected_at: string | null
          connection_metadata: Json | null
          connection_status: string | null
          created_at: string | null
          editorial_profile: string | null
          external_account_id: string | null
          external_display_name: string | null
          id: string
          last_post_at: string | null
          last_sync_at: string | null
          metadata: Json | null
          platform: string
          posting_enabled: boolean | null
          posts_per_day: number | null
          posts_today: number | null
          preferred_categories: string[] | null
          profile_image_url: string | null
          provider: string | null
          provider_account_id: string | null
          provider_connection_id: string | null
          provider_profile_id: string | null
          provider_status: string | null
          receive_all_campaigns: boolean | null
          status: string | null
          timezone: string | null
          token_expires_at: string | null
          total_posts: number | null
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          account_name?: string | null
          artist_id?: string | null
          avatar_url?: string | null
          connected_at?: string | null
          connection_metadata?: Json | null
          connection_status?: string | null
          created_at?: string | null
          editorial_profile?: string | null
          external_account_id?: string | null
          external_display_name?: string | null
          id?: string
          last_post_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          platform: string
          posting_enabled?: boolean | null
          posts_per_day?: number | null
          posts_today?: number | null
          preferred_categories?: string[] | null
          profile_image_url?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_connection_id?: string | null
          provider_profile_id?: string | null
          provider_status?: string | null
          receive_all_campaigns?: boolean | null
          status?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          total_posts?: number | null
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          account_name?: string | null
          artist_id?: string | null
          avatar_url?: string | null
          connected_at?: string | null
          connection_metadata?: Json | null
          connection_status?: string | null
          created_at?: string | null
          editorial_profile?: string | null
          external_account_id?: string | null
          external_display_name?: string | null
          id?: string
          last_post_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          platform?: string
          posting_enabled?: boolean | null
          posts_per_day?: number | null
          posts_today?: number | null
          preferred_categories?: string[] | null
          profile_image_url?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_connection_id?: string | null
          provider_profile_id?: string | null
          provider_status?: string | null
          receive_all_campaigns?: boolean | null
          status?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          total_posts?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      social_oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          social_account_id: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          social_account_id: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          social_account_id?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_oauth_states_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          vezes_usada?: number | null
        }
        Relationships: []
      }
      videos_processados: {
        Row: {
          criado_em: string
          id: string
          music_track_id: string | null
          storage_path: string
          video_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          music_track_id?: string | null
          storage_path: string
          video_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          music_track_id?: string | null
          storage_path?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_processados_music_track_id_fkey"
            columns: ["music_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_processados_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_render_job: {
        Args: { lease_interval?: string }
        Returns: {
          attempts: number | null
          audio_mode: string | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          file_size: number | null
          id: string
          is_approved: boolean | null
          last_heartbeat: string | null
          max_attempts: number | null
          music_start_ms: number | null
          music_track_id: string | null
          music_volume: number | null
          original_audio_volume: number | null
          output_profile: string | null
          render_key: string
          render_options: Json | null
          source_content_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["render_status"]
          storage_path: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "media_renders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dispatch_publications: { Args: never; Returns: Json }
      generate_unique_artist_slug: {
        Args: { p_exclude_id?: string; p_name: string; p_user_id: string }
        Returns: string
      }
      heartbeat_render_job: { Args: { job_id: string }; Returns: undefined }
      insert_media_render: {
        Args: {
          p_audio_mode: string
          p_music_start_ms: number
          p_music_track_id: string
          p_music_volume: number
          p_original_audio_volume: number
          p_source_content_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      render_status: "queued" | "processing" | "ready" | "failed" | "cancelled"
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
      render_status: ["queued", "processing", "ready", "failed", "cancelled"],
    },
  },
} as const
