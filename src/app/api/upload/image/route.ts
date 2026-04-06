import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

// WHY: Proxies file uploads to the .ai backend which writes to the VPS
// uploads directory and creates a Generation record so the file shows up
// in the user's asset library and survives page reloads.

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`upload:${email}`, 30);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Parse the multipart form data on this side first to validate
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    }

    // Forward to .ai — pass through the form data with the API key
    const apiKey = process.env.PRINCE_API_KEY ?? "";
    const apiUrl = process.env.PRINCE_API_URL ?? "https://princemarketing.ai";

    // Build a fresh FormData since we already consumed the request body
    const forwardForm = new FormData();
    forwardForm.append("file", file);
    const label = formData.get("label");
    if (label) forwardForm.append("label", String(label));
    const category = formData.get("category");
    if (category) forwardForm.append("category", String(category));

    const res = await fetch(`${apiUrl}/api/v1/upload/image`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: forwardForm,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Upload/Image] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
