// Supabase Edge Function: gemini-proxy
// Required secret: GEMINI_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const allowedModels = new Set([
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Login diperlukan." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiKey) {
      return json({ error: "Konfigurasi server belum lengkap." }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sesi login tidak valid." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.is_active !== true) {
      return json({ error: "Akun tidak aktif atau tidak memiliki akses." }, 403);
    }

    const body = await req.json();
    const model = body?.model;
    const payload = body?.payload;
    if (typeof model !== "string" || !allowedModels.has(model) || !payload || typeof payload !== "object") {
      return json({ error: "Permintaan tidak valid." }, 400);
    }

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await upstream.json().catch(() => ({}));
    return json(result, upstream.status);
  } catch (error) {
    console.error("gemini-proxy error:", error);
    return json({ error: "Terjadi kesalahan pada layanan AI." }, 500);
  }
});
