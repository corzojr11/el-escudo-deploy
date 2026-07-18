"use server";

import { deleteFromBackend, fetchFromBackend, postToBackend, putToBackend } from "@/lib/api/server";
import type { PersonalEntry, PersonalEntryKind } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

function revalidatePersonalViews() {
  revalidatePath("/bitacora");
  revalidatePath("/plan-semanal");
  revalidatePath("/finanzas");
  revalidatePath("/alimentacion");
}

export async function getPersonalEntries(): Promise<PersonalEntry[]> {
  const result = await fetchFromBackend<{ entries: PersonalEntry[] }>("/api/v1/personal-entries");
  return result.entries ?? [];
}

export async function createPersonalEntry(data: {
  kind: PersonalEntryKind;
  title: string;
  content?: string;
  entry_date?: string;
  data?: Record<string, unknown>;
}): Promise<PersonalEntry> {
  const result = await postToBackend<{ entry: PersonalEntry }>("/api/v1/personal-entries", data);
  revalidatePersonalViews();
  return result.entry;
}

export async function updatePersonalEntry(
  id: string,
  data: Pick<PersonalEntry, "title" | "content" | "data">
): Promise<PersonalEntry> {
  const result = await putToBackend<{ entry: PersonalEntry }>(`/api/v1/personal-entries/${id}`, data);
  revalidatePersonalViews();
  return result.entry;
}

export async function deletePersonalEntry(id: string): Promise<void> {
  await deleteFromBackend(`/api/v1/personal-entries/${id}`);
  revalidatePersonalViews();
}
