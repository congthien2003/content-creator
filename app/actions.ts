"use server";

import { createClient } from "@/utils/supabase/server";
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowMetadata,
} from "@/lib/types";
import {
  runContentStep,
  runImageIdeaStep,
  runImageOptionsStep,
  runOutlineStep,
} from "@/lib/server/services/workflowService";
import { saveDraft } from "@/lib/server/services/draftService";

async function getAuthenticatedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      error: "Bạn cần đăng nhập để cập nhật draft.",
    };
  }

  return { supabase, user, error: null };
}

export async function generateOutline(input: {
  workflowId?: string | null;
  topic: string;
  platform: Platform;
  postLength: PostLength;
  postType: PostType;
  useIcons?: boolean;
}) {
  return runOutlineStep(input);
}

export async function generateImageIdea(input: {
  workflowId?: string | null;
  topic: string;
  platform: Platform;
  postLength: PostLength;
  postType: PostType;
  useIcons?: boolean;
  outline: string;
}) {
  return runImageIdeaStep(input);
}

export async function generateContentFromWorkflow(input: {
  workflowId?: string | null;
  topic: string;
  platform: Platform;
  postLength: PostLength;
  postType: PostType;
  outline: string;
  imageIdea: string;
  useIcons?: boolean;
}) {
  return runContentStep(input);
}

export async function generateImages3Options(input: {
  workflowId?: string | null;
  topic: string;
  platform: Platform;
  postLength: PostLength;
  postType: PostType;
  useIcons?: boolean;
  imageIdea: string;
}) {
  return runImageOptionsStep(input);
}

export async function saveWorkflowDraft(input: {
  workflowId?: string | null;
  topic: string;
  content: string;
  platform: Platform;
  postLength: PostLength;
  metadata: WorkflowMetadata;
}) {
  try {
    return await saveDraft(input);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi lưu draft.",
    };
  }
}

export async function markAsPublished(draftId: string) {
  const context = await getAuthenticatedSupabase();
  if (!context.user) {
    return { success: false, error: context.error };
  }

  const { supabase } = context;
  const { data, error } = await supabase
    .from("drafts")
    .update({ status: "published" })
    .eq("id", draftId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Không tìm thấy draft phù hợp." };
  }
  return { success: true };
}

export async function markAsDraft(draftId: string) {
  const context = await getAuthenticatedSupabase();
  if (!context.user) {
    return { success: false, error: context.error };
  }

  const { supabase } = context;
  const { data, error } = await supabase
    .from("drafts")
    .update({ status: "draft" })
    .eq("id", draftId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Không tìm thấy draft phù hợp." };
  }
  return { success: true };
}

export async function deleteDraft(draftId: string) {
  const context = await getAuthenticatedSupabase();
  if (!context.user) {
    return { success: false, error: context.error };
  }

  const { supabase } = context;
  const { data, error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "Không tìm thấy draft phù hợp." };
  }
  return { success: true };
}
