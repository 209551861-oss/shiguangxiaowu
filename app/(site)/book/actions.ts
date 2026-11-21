"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 保存小节学习状态。
 * 只写 section_progress，不碰 section 本身。
 * RLS 保证只能写 auth.uid() 自己的行；未登录会失败，页面据此提示。
 */
export async function saveProgress(formData: FormData) {
  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const contentVersion = String(formData.get("contentVersion") ?? "").trim();
  const back = String(formData.get("back") ?? "/book").trim();

  if (!sectionId || !action) {
    redirect(`${back}?section=${slug}&msg=missing`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${back}?section=${slug}&msg=login`);
  }

  if (action === "stuck" && note.length === 0) {
    redirect(`${back}?section=${slug}&msg=note-required`);
  }

  const now = new Date().toISOString();

  let patch: Record<string, unknown>;
  if (action === "complete") {
    patch = {
      user_id: user.id,
      section_id: sectionId,
      status: "completed",
      completed_at: now,
      completed_content_version: contentVersion || null,
      stuck_note: null,
    };
  } else if (action === "stuck") {
    patch = {
      user_id: user.id,
      section_id: sectionId,
      status: "stuck",
      stuck_note: note.slice(0, 500),
    };
  } else if (action === "reopen") {
    patch = {
      user_id: user.id,
      section_id: sectionId,
      status: "in_progress",
      completed_at: null,
      completed_content_version: null,
    };
  } else {
    redirect(`${back}?section=${slug}&msg=missing`);
  }

  const { error } = await supabase
    .from("section_progress")
    .upsert(patch, { onConflict: "user_id,section_id" });

  if (error) {
    redirect(`${back}?section=${slug}&msg=save-failed`);
  }

  revalidatePath("/book");
  revalidatePath("/study");
  redirect(`${back}?section=${slug}&msg=saved`);
}
