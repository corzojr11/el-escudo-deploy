"use server";

import { postToBackend } from "@/lib/api/server";

export async function getContextualOmniAdvice(section: string, question: string): Promise<{ response: string; cost_cop: number }> {
  return postToBackend<{ response: string; cost_cop: number }>("/api/v1/omni/contextual-advice", { section, question });
}
