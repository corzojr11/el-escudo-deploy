"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend } from "@/lib/api/server";
import type {
  OmniResponse,
  OmniMessagesResponse,
} from "@/lib/api/types";

export async function sendOmniCommand(command: string, sessionId?: string): Promise<OmniResponse> {
  const result = await postToBackend<OmniResponse>("/api/v1/process-command", {
    command,
    session_id: sessionId,
  });

  revalidatePath("/");
  revalidatePath("/omni");

  return result;
}

export async function getOmniMessages(limit = 30): Promise<OmniMessagesResponse> {
  return fetchFromBackend<OmniMessagesResponse>(
    `/api/v1/omni/messages?limit=${limit}`
  );
}
