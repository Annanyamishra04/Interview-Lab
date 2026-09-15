import type {
  DifficultyLevel,
  ExperienceLevel,
  InterviewType,
} from "@/lib/validation/interview";

/**
 * These types mirror the tables described in the Phase 2 database plan
 * (see README → Database schema). Keeping them in one file means the UI,
 * services, and future Supabase types can all converge on one shape.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Interview {
  id: string;
  userId: string;
  role: string;
  experienceLevel: ExperienceLevel;
  interviewType: InterviewType;
  difficulty: DifficultyLevel;
  topics: string[];
  status: "draft" | "in-progress" | "completed";
  createdAt: string;
  completedAt: string | null;
}

export interface InterviewQuestion {
  id: string;
  interviewId: string;
  order: number;
  prompt: string;
  topic: string;
  isFollowUp: boolean;
  parentQuestionId: string | null;
}

export interface InterviewAnswer {
  id: string;
  questionId: string;
  answerText: string;
  submittedAt: string;
}

export interface Evaluation {
  id: string;
  answerId: string;
  score: number; // 0–10
  strengths: string[];
  improvements: string[];
  followUpQuestion: string | null;
  createdAt: string;
}

export interface SavedQuestion {
  id: string;
  userId: string;
  questionId: string;
  note: string | null;
  savedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  storagePath: string;
  parsedSummary: string | null;
  uploadedAt: string;
}

export interface InterviewSession {
  id: string;
  interviewId: string;
  startedAt: string;
  endedAt: string | null;
  currentQuestionIndex: number;
}
