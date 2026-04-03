export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: {
          created_at: string;
          id: string;
          is_public: boolean;
          name: string;
          organization_id: string;
          settings: Json;
          slug: string;
          sport_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_public?: boolean;
          name: string;
          organization_id: string;
          settings?: Json;
          slug: string;
          sport_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_public?: boolean;
          name?: string;
          organization_id?: string;
          settings?: Json;
          slug?: string;
          sport_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          created_at: string;
          ends_on: string | null;
          id: string;
          is_active: boolean;
          league_id: string;
          name: string;
          starts_on: string | null;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          league_id: string;
          name: string;
          starts_on?: string | null;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          league_id?: string;
          name?: string;
          starts_on?: string | null;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          league_id: string;
          logo_url: string | null;
          name: string;
          primary_color: string | null;
          secondary_color: string | null;
          slug: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          league_id: string;
          logo_url?: string | null;
          name: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          league_id?: string;
          logo_url?: string | null;
          name?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          created_at: string;
          first_name: string;
          id: string;
          jersey_number: string | null;
          last_name: string;
          position: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_name: string;
          id?: string;
          jersey_number?: string | null;
          last_name: string;
          position?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_name?: string;
          id?: string;
          jersey_number?: string | null;
          last_name?: string;
          position?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_rosters: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          player_id: string;
          role: string | null;
          season_id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          player_id: string;
          role?: string | null;
          season_id: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          player_id?: string;
          role?: string | null;
          season_id?: string;
          team_id?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          away_score: number;
          away_team_id: string;
          created_at: string;
          home_score: number;
          home_team_id: string;
          id: string;
          is_public: boolean;
          league_id: string;
          metadata: Json;
          period_label: string | null;
          scheduled_at: string;
          season_id: string;
          sport_id: string;
          status: "scheduled" | "live" | "final" | "postponed" | "canceled";
          stream_provider: string | null;
          stream_url: string | null;
          updated_at: string;
          venue_name: string | null;
        };
        Insert: {
          away_score?: number;
          away_team_id: string;
          created_at?: string;
          home_score?: number;
          home_team_id: string;
          id?: string;
          is_public?: boolean;
          league_id: string;
          metadata?: Json;
          period_label?: string | null;
          scheduled_at: string;
          season_id: string;
          sport_id: string;
          status?: "scheduled" | "live" | "final" | "postponed" | "canceled";
          stream_provider?: string | null;
          stream_url?: string | null;
          updated_at?: string;
          venue_name?: string | null;
        };
        Update: {
          away_score?: number;
          away_team_id?: string;
          created_at?: string;
          home_score?: number;
          home_team_id?: string;
          id?: string;
          is_public?: boolean;
          league_id?: string;
          metadata?: Json;
          period_label?: string | null;
          scheduled_at?: string;
          season_id?: string;
          sport_id?: string;
          status?: "scheduled" | "live" | "final" | "postponed" | "canceled";
          stream_provider?: string | null;
          stream_url?: string | null;
          updated_at?: string;
          venue_name?: string | null;
        };
        Relationships: [];
      };
      game_team_stats: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          stats: Json;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          stats?: Json;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          stats?: Json;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_events: {
        Row: {
          actor_name: string | null;
          created_at: string;
          event_index: number;
          event_type: string;
          game_id: string;
          id: string;
          payload: Json;
          points_away: number;
          points_home: number;
          source: string;
        };
        Insert: {
          actor_name?: string | null;
          created_at?: string;
          event_index: number;
          event_type: string;
          game_id: string;
          id?: string;
          payload?: Json;
          points_away?: number;
          points_home?: number;
          source?: string;
        };
        Update: {
          actor_name?: string | null;
          created_at?: string;
          event_index?: number;
          event_type?: string;
          game_id?: string;
          id?: string;
          payload?: Json;
          points_away?: number;
          points_home?: number;
          source?: string;
        };
        Relationships: [];
      };
      player_game_stats: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          minutes_played: number | null;
          player_id: string;
          starter: boolean;
          stats: Json;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          minutes_played?: number | null;
          player_id: string;
          starter?: boolean;
          stats?: Json;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          minutes_played?: number | null;
          player_id?: string;
          starter?: boolean;
          stats?: Json;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sports: {
        Row: {
          id: string;
          name: string;
          scoring_model: string;
        };
        Insert: {
          id: string;
          name: string;
          scoring_model: string;
        };
        Update: {
          id?: string;
          name?: string;
          scoring_model?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      standings: {
        Row: {
          league_id: string;
          losses: number;
          point_diff: number;
          points_against: number;
          points_for: number;
          season_id: string;
          team_id: string;
          team_name: string;
          ties: number;
          wins: number;
        };
        Relationships: [];
      };
    };
  };
}
