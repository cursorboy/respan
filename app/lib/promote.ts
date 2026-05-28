// Self-driving loop: promote a winning variant into a Respan managed prompt and
// deploy it as the live version. Uses the official @respan/respan-api SDK, so the
// request shapes are exactly what Respan expects (no guessed endpoints).
//
// Lifecycle (verified against the SDK): createPrompt -> createPromptVersion (draft)
// -> commitPromptVersion (readonly snapshot) -> deployPromptVersion (go live).
// The winning variant's {{input}} placeholder becomes a managed `input` variable.

import "server-only";
import { RespanClient } from "@respan/respan-api";

export interface PromoteInput {
  apiKey: string;
  /** Optional override for the management API base (defaults to the SDK's). */
  baseUrl?: string;
  /** Name for the managed prompt (created if promptId is absent). */
  name: string;
  /** The winning variant's prompt text, using {{input}} as the template variable. */
  promptText: string;
  model: string;
  /** Reuse an existing managed prompt instead of creating one. */
  promptId?: string;
}

export interface PromoteResult {
  promptId: string;
  version: number;
}

export async function promoteWinner(input: PromoteInput): Promise<PromoteResult> {
  const client = new RespanClient(input.baseUrl ? { baseUrl: input.baseUrl } : {});
  const Authorization = `Bearer ${input.apiKey}`;

  let promptId = input.promptId;
  if (!promptId) {
    const created = await client.prompts.createPrompt({ Authorization, name: input.name });
    if (!created.id) throw new Error("Respan did not return a prompt id on create.");
    promptId = created.id;
  }

  const draft = await client.prompts.createPromptVersion({
    Authorization,
    prompt_id: promptId,
    description: "Promoted from PromptArena winning variant",
    messages: [{ role: "user", content: input.promptText }],
    model: input.model,
    temperature: 0,
    deploy: false,
  });
  const version = draft.version;
  if (version === undefined) {
    throw new Error("Respan did not return a version number on create-version.");
  }

  // Commit the draft to a readonly snapshot, then deploy it as the live version.
  await client.prompts.commitPromptVersion({ Authorization, prompt_id: promptId });
  await client.prompts.deployPromptVersion({ Authorization, prompt_id: promptId, version });

  return { promptId, version };
}
