import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

const supabaseUrl = `https://${projectId}.supabase.co`
const supabaseAnonKey = publicAnonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export type Database = {
  public: {
    Tables: {
      containers: {
        Row: {
          id: string
          name: string
          type: 'box_9x9' | 'box_5x5' | 'rack_5x4' | 'rack_9x9'
          sample_type: 'BC Tubes' | 'Plasma Tubes' | null
          status: 'active' | 'training' | 'archived'
          location_freezer: string
          location_rack?: string
          location_drawer?: string
          samples: any
          created_at: string
          created_by: string
          updated_at: string
          updated_by: string
          locked_by?: string
          locked_at?: string
        }
        Insert: {
          id?: string
          name: string
          type: 'box_9x9' | 'box_5x5' | 'rack_5x4' | 'rack_9x9'
          sample_type?: 'BC Tubes' | 'Plasma Tubes' | null
          status?: 'active' | 'training' | 'archived'
          location_freezer: string
          location_rack?: string
          location_drawer?: string
          samples?: any
          created_by: string
          updated_by: string
          locked_by?: string
          locked_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'box_9x9' | 'box_5x5' | 'rack_5x4' | 'rack_9x9'
          sample_type?: 'BC Tubes' | 'Plasma Tubes' | null
          status?: 'active' | 'training' | 'archived'
          location_freezer?: string
          location_rack?: string
          location_drawer?: string
          samples?: any
          updated_by?: string
          locked_by?: string
          locked_at?: string
        }
      }
      users: {
        Row: {
          id: string
          username: string
          email: string
          full_name: string
          role_id: string
          is_active: boolean
          created_at: string
          created_by: string
          updated_at: string
          last_login?: string
        }
        Insert: {
          id?: string
          username: string
          email: string
          full_name: string
          role_id: string
          is_active?: boolean
          created_by: string
        }
        Update: {
          id?: string
          username?: string
          email?: string
          full_name?: string
          role_id?: string
          is_active?: boolean
          updated_at?: string
          last_login?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          name: string
          level: number
          permissions: any
          color: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          level: number
          permissions: any
          color: string
          description: string
        }
        Update: {
          id?: string
          name?: string
          level?: number
          permissions?: any
          color?: string
          description?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action_type: string
          resource_type: string
          resource_id: string
          user_id: string
          user_name: string
          details: any
          old_values?: any
          new_values?: any
          metadata?: any
          severity: 'low' | 'medium' | 'high' | 'critical'
          success: boolean
          timestamp: string
        }
        Insert: {
          id?: string
          action_type: string
          resource_type: string
          resource_id: string
          user_id: string
          user_name: string
          details?: any
          old_values?: any
          new_values?: any
          metadata?: any
          severity?: 'low' | 'medium' | 'high' | 'critical'
          success?: boolean
        }
        Update: {
          id?: string
          action_type?: string
          resource_type?: string
          resource_id?: string
          user_id?: string
          user_name?: string
          details?: any
          old_values?: any
          new_values?: any
          metadata?: any
          severity?: 'low' | 'medium' | 'high' | 'critical'
          success?: boolean
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          user_name: string
          activity_type: string
          container_id?: string
          last_seen: string
          status: 'active' | 'idle' | 'offline'
          metadata?: any
        }
        Insert: {
          id?: string
          user_id: string
          user_name: string
          activity_type: string
          container_id?: string
          status?: 'active' | 'idle' | 'offline'
          metadata?: any
        }
        Update: {
          id?: string
          user_id?: string
          user_name?: string
          activity_type?: string
          container_id?: string
          last_seen?: string
          status?: 'active' | 'idle' | 'offline'
          metadata?: any
        }
      }
    }
  }
}