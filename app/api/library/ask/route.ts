import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerQuestion } from "@/lib/rag/answer";

/**
 * POST /api/library/ask
 * 页面问资料只调这个：服务端检索 → 模型 → 校验引用 → 落 qa_message。
 * 前端拿到的 citations 全部由服务端按数据库元数据生成，模型输出的路径一概不采信。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: { message: "登录后才能提问（资料是私人内容）", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { question?: string; documentId?: string; sessionId?: string; model?: string }
    | null;

  const question = body?.question?.trim();
  if (!question) {
    return Response.json(
      { error: { message: "问题不能为空", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const documentId = body?.documentId || null;

  let documentTitle: string | undefined;
  if (documentId) {
    const { data: doc } = await supabase
      .from("document")
      .select("title")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) {
      return Response.json(
        { error: { message: "这份资料不存在，或不属于你", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }
    documentTitle = doc.title as string;
  }

  let result;
  try {
    result = await answerQuestion(supabase, {
      question,
      documentId,
      documentTitle,
      model: body?.model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const noChannel = message === "no-channel";
    return Response.json(
      {
        error: {
          message: noChannel
            ? "当前无可用模型通道：归一桥没启动，服务端也没配 DEEPSEEK_API_KEY。"
            : `回答失败：${message}`,
          code: noChannel ? "NO_CHANNEL" : "ASK_FAILED",
        },
      },
      { status: noChannel ? 503 : 500 }
    );
  }

  // 落库（service role：assistant 这一条不是用户直接写的）
  const admin = createAdminClient();
  let sessionId = body?.sessionId ?? null;

  if (sessionId) {
    const { data: s } = await admin
      .from("qa_session")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!s) sessionId = null;
  }

  if (!sessionId) {
    const { data: created } = await admin
      .from("qa_session")
      .insert({
        user_id: user.id,
        document_id: documentId,
        title: question.slice(0, 40),
      })
      .select("id")
      .single();
    sessionId = (created?.id as string) ?? null;
  }

  if (sessionId) {
    await admin.from("qa_message").insert([
      { session_id: sessionId, user_id: user.id, role: "user", content: question },
      {
        session_id: sessionId,
        user_id: user.id,
        role: "assistant",
        content: result.answer,
        citations: result.citations,
        model: result.model,
        channel: result.channel,
        latency_ms: result.latencyMs,
      },
    ]);
  }

  return Response.json({
    ok: true,
    sessionId,
    answer: result.answer,
    citations: result.citations,
    refused: result.refused,
    channel: result.channel,
    model: result.model,
    latencyMs: result.latencyMs,
    debug: {
      hits: result.hits.length,
      bestCoverage: Number(result.bestCoverage.toFixed(2)),
      vectorUsed: !result.vectorSkipped,
      usage: result.usage,
    },
  });
}
