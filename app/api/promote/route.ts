// POST /api/promote — promote a winning variant to a deployed Respan managed
// prompt version. Body: { name, promptText, model?, promptId? }.

import { getEnv, EnvError } from "@/app/lib/env";
import { errorMessage } from "@/app/lib/respan";
import { promoteWinner } from "@/app/lib/promote";
import { INPUT_PLACEHOLDER } from "@/app/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PromoteBody {
  name?: string;
  promptText?: string;
  model?: string;
  promptId?: string;
}

export async function POST(req: Request): Promise<Response> {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    const message = err instanceof EnvError ? err.message : errorMessage(err);
    return Response.json({ error: message }, { status: 500 });
  }

  let body: PromoteBody;
  try {
    body = (await req.json()) as PromoteBody;
  } catch {
    return Response.json({ error: "Request body was not valid JSON." }, { status: 400 });
  }

  const name = body.name?.trim();
  const promptText = body.promptText?.trim();
  if (!name) return Response.json({ error: "A prompt name is required." }, { status: 400 });
  if (!promptText) return Response.json({ error: "Prompt text is required." }, { status: 400 });
  if (!promptText.includes(INPUT_PLACEHOLDER)) {
    return Response.json(
      { error: `Prompt text must contain ${INPUT_PLACEHOLDER} to be a usable template.` },
      { status: 400 },
    );
  }

  try {
    const result = await promoteWinner({
      apiKey: env.apiKey,
      baseUrl: env.apiBaseUrl,
      name,
      promptText,
      model: body.model?.trim() || env.model,
      promptId: body.promptId?.trim() || undefined,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
