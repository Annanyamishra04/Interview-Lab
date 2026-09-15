/**
 * Hand-authored to mirror `supabase/migrations/20250101000000_init_schema.sql`
 * exactly. Once a real Supabase project exists, regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id <project-id> > types/database.ts
 *
 * and delete this comment — the generated file has the same shape, so no
 * other file in the app needs to change.
 */

export type InterviewStatus = "draft" | "in_progress" | "completed";
export type ResumeUploadStatus = "pending" | "uploaded" | "extracting" | "ready" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          target_role: string | null;
          experience_level: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          target_role?: string | null;
          experience_level?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      interviews: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          target_role: string;
          experience_level: string;
          interview_type: string;
          difficulty: string;
          topics: string[];
          question_count: number;
          status: InterviewStatus;
          completed_at: string | null;
          resume_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          target_role: string;
          experience_level: string;
          interview_type: string;
          difficulty: string;
          topics?: string[];
          question_count?: number;
          status?: InterviewStatus;
          completed_at?: string | null;
          resume_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["interviews"]["Insert"]>;
      };
      interview_questions: {
        Row: {
          id: string;
          interview_id: string;
          question_text: string;
          question_type: string | null;
          topic: string | null;
          difficulty: string | null;
          question_order: number;
          model_answer: string | null;
          explanation: string | null;
          what_it_tests: string | null;
          key_points: string[];
          is_follow_up: boolean;
          parent_question_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          question_text: string;
          question_type?: string | null;
          topic?: string | null;
          difficulty?: string | null;
          question_order: number;
          model_answer?: string | null;
          explanation?: string | null;
          what_it_tests?: string | null;
          key_points?: string[];
          is_follow_up?: boolean;
          parent_question_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["interview_questions"]["Insert"]>;
      };
      interview_answers: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          answer_text: string;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          answer_text: string;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["interview_answers"]["Insert"]>;
      };
      evaluations: {
        Row: {
          id: string;
          answer_id: string;
          overall_score: number | null;
          technical_score: number | null;
          communication_score: number | null;
          accuracy_score: number | null;
          confidence_score: number | null;
          strengths: string[];
          weaknesses: string[];
          feedback: string | null;
          improvement_suggestions: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          answer_id: string;
          overall_score?: number | null;
          technical_score?: number | null;
          communication_score?: number | null;
          accuracy_score?: number | null;
          confidence_score?: number | null;
          strengths?: string[];
          weaknesses?: string[];
          feedback?: string | null;
          improvement_suggestions?: string[];
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["evaluations"]["Insert"]>;
      };
      saved_questions: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["saved_questions"]["Insert"]>;
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_name: string | null;
          storage_path: string | null;
          extracted_text: string | null;
          file_type: string | null;
          file_size: number | null;
          content_hash: string | null;
          upload_status: ResumeUploadStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name?: string | null;
          storage_path?: string | null;
          extracted_text?: string | null;
          file_type?: string | null;
          file_size?: number | null;
          content_hash?: string | null;
          upload_status?: ResumeUploadStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["resumes"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
