"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend } from "@/lib/api/server";
import type {
  OmniResponse,
  OmniConfirmResult,
  OmniProcessingResponse,
  OmniMessagesResponse,
  OmniPatternsResponse,
} from "@/lib/api/types";

export async function sendOmniCommand(
  command: string,
  sessionId?: string
): Promise<OmniResponse> {
  const result = await postToBackend<OmniResponse>("/api/v1/process-command", {
    command,
    session_id: sessionId,
  });

  return result;
}

export async function confirmOmniProposal(
  proposalId: string,
  sessionId?: string
): Promise<OmniConfirmResult | OmniProcessingResponse> {
  const result = await postToBackend<OmniConfirmResult>(
    `/api/v1/process-command/${encodeURIComponent(proposalId)}/confirm`,
    { session_id: sessionId }
  );

  revalidatePath("/");
  revalidatePath("/omni");

  return result;
}

export async function cancelOmniProposal(
  proposalId: string
): Promise<{ proposal_id: string; status: string }> {
  const result = await postToBackend<{ proposal_id: string; status: string }>(
    `/api/v1/process-command/${encodeURIComponent(proposalId)}/cancel`,
    {}
  );

  return result;
}

export async function getOmniMessages(
  limit = 30,
  offset = 0,
  sessionId?: string
): Promise<OmniMessagesResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (sessionId) {
    params.set("session_id", sessionId);
  }
  return fetchFromBackend<OmniMessagesResponse>(
    `/api/v1/omni/messages?${params.toString()}`
  );
}

export async function getOmniPatterns(): Promise<OmniPatternsResponse> {
  return fetchFromBackend<OmniPatternsResponse>("/api/v1/omni/patterns-insights");
}
