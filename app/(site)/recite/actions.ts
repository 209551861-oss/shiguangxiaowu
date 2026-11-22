"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertReciteOwner } from "@/lib/recite/guard";
import { isRatingKey } from "@/lib/recite/fsrs";
import {
  createItem,
  createUnit,
  deleteAttachment,
  deleteItem,
  deleteUnit,
  ensureQaUnit,
  saveSettings,
  submitReview,
  updateItem,
  updateUnit,
} from "@/lib/services/recite";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const bool = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
};

/** 新建内容：先落一行草稿，再进编辑页（这样图片上传从第一刻就有归属） */
export async function createItemAction(formData: FormData) {
  const { user } = await assertReciteOwner();
  const type = str(formData, "type") === "qa" ? "qa" : "note";
  const id = await createItem(user.id, type);
  redirect(`/recite/item/${id}`);
}

export async function saveItemAction(formData: FormData) {
  const { user } = await assertReciteOwner();
  const id = str(formData, "id");
  if (!id) redirect("/recite/library");

  const type = str(formData, "type") === "qa" ? "qa" : "note";
  const tags = str(formData, "tags")
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const patch: Record<string, unknown> = {
    title: str(formData, "title").slice(0, 200) || (type === "qa" ? "未命名问答" : "未命名笔记"),
    category: str(formData, "category").slice(0, 60) || null,
    tags,
    review_enabled: bool(formData, "review_enabled"),
  };

  if (type === "qa") {
    patch.question_md = str(formData, "question_md");
    patch.answer_md = str(formData, "answer_md");
  } else {
    patch.body_md = str(formData, "body_md");
  }

  try {
    await updateItem(id, patch);
    if (type === "qa") {
      await ensureQaUnit(
        user.id,
        id,
        String(patch.question_md ?? ""),
        String(patch.answer_md ?? ""),
        Boolean(patch.review_enabled)
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    redirect(`/recite/item/${id}?err=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/recite/item/${id}`);
  revalidatePath("/recite/library");
  revalidatePath("/recite");

  redirect(`/recite/item/${id}?saved=1`);
}

export async function deleteItemAction(formData: FormData) {
  await assertReciteOwner();
  const id = str(formData, "id");
  const keepUnits = str(formData, "mode") !== "all";
  if (id) await deleteItem(id, keepUnits);
  revalidatePath("/recite/library");
  revalidatePath("/recite");
  redirect("/recite/library?deleted=1");
}

/** 从笔记选中文字创建复习单元：选中内容进背面，正面留空等用户填 */
export async function createUnitFromSelectionAction(formData: FormData) {
  const { user } = await assertReciteOwner();
  const itemId = str(formData, "itemId");
  const front = str(formData, "front_md");
  const back = str(formData, "back_md");

  if (!back) redirect(`/recite/item/${itemId}?err=${encodeURIComponent("选中的内容为空")}`);

  const anchorRaw = str(formData, "anchor");
  let anchor: Record<string, unknown> | null = null;
  if (anchorRaw) {
    try {
      anchor = JSON.parse(anchorRaw) as Record<string, unknown>;
    } catch {
      anchor = null;
    }
  }

  const unitId = await createUnit(user.id, {
    front_md: front,
    back_md: back,
    source_item_id: itemId || null,
    source_type: "note_selection",
    source_snapshot: back,
    source_anchor: anchor,
    review_enabled: true,
  });

  revalidatePath(`/recite/item/${itemId}`);
  redirect(`/recite/units/${unitId}?created=1`);
}

export async function createManualUnitAction(formData: FormData) {
  const { user } = await assertReciteOwner();
  const unitId = await createUnit(user.id, {
    front_md: "",
    back_md: "",
    source_type: "manual",
  });
  redirect(`/recite/units/${unitId}?created=1`);
}

export async function saveUnitAction(formData: FormData) {
  await assertReciteOwner();
  const id = str(formData, "id");
  if (!id) redirect("/recite/library");

  try {
    await updateUnit(id, {
      front_md: str(formData, "front_md"),
      back_md: str(formData, "back_md"),
      review_enabled: bool(formData, "review_enabled"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    redirect(`/recite/units/${id}?err=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/recite/units/${id}`);
  redirect(`/recite/units/${id}?saved=1`);
}

export async function toggleUnitAction(formData: FormData) {
  await assertReciteOwner();
  const id = str(formData, "id");
  const enabled = str(formData, "enabled") === "1";
  const back = str(formData, "back") || "/recite/library";
  if (id) await updateUnit(id, { review_enabled: enabled });
  revalidatePath(back);
  redirect(back);
}

export async function deleteUnitAction(formData: FormData) {
  await assertReciteOwner();
  const id = str(formData, "id");
  const back = str(formData, "back") || "/recite/library";
  if (id) await deleteUnit(id);
  revalidatePath("/recite/library");
  redirect(back);
}

/** 复习提交：返回调度结果给复习界面，不整页刷新 */
export async function submitReviewAction(input: {
  unitId: string;
  rating: string;
  token: string;
}) {
  const { user } = await assertReciteOwner();
  if (!isRatingKey(input.rating)) throw new Error("未知评价");
  if (!input.unitId) throw new Error("缺少卡片");

  const result = await submitReview(user.id, input.unitId, input.rating, input.token);
  revalidatePath("/recite");
  revalidatePath("/recite/stats");
  return result;
}

export async function deleteAttachmentAction(formData: FormData) {
  await assertReciteOwner();
  const id = str(formData, "id");
  const back = str(formData, "back") || "/recite/library";
  if (id) await deleteAttachment(id);
  revalidatePath(back);
  redirect(back);
}

export async function saveSettingsAction(formData: FormData) {  const { user } = await assertReciteOwner();
  const limit = Number(str(formData, "daily_new_limit"));
  const retention = Number(str(formData, "desired_retention"));
  const timezone = str(formData, "timezone") || "Asia/Shanghai";

  await saveSettings(user.id, {
    daily_new_limit: Number.isFinite(limit) ? Math.min(500, Math.max(0, Math.round(limit))) : 10,
    auto_new_enabled: bool(formData, "auto_new_enabled"),
    desired_retention: Number.isFinite(retention)
      ? Math.min(0.99, Math.max(0.7, retention))
      : 0.9,
    timezone,
  });

  revalidatePath("/recite/stats");
  revalidatePath("/recite");
  redirect("/recite/stats?saved=1");
}
