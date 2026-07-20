"use server";

import { revalidatePath } from "next/cache";
import {
  fetchFromBackend,
  postToBackend,
  putToBackend,
  apiRequest,
} from "@/lib/api/server";
import type {
  ShiftListResponse,
  CurrentStatusResponse,
  CreateShiftResponse,
  Shift,
} from "@/lib/api/types";

export async function getShifts() {
  const res = await fetchFromBackend<ShiftListResponse>("/api/v1/shifts");
  return res.shifts ?? [];
}

export async function getCurrentStatus() {
  return fetchFromBackend<CurrentStatusResponse>("/api/v1/current-status");
}

export interface CreateShiftResult {
  success: boolean;
  error?: string;
}

export async function createShift(
  _prevState: CreateShiftResult | null,
  formData: FormData
): Promise<CreateShiftResult> {
  const day = (formData.get("day") as string) || "";
  const type = (formData.get("type") as string) || "work";
  let start = (formData.get("start") as string) || "";
  let end = (formData.get("end") as string) || "";

  if (type === "rest" || type === "travel") {
    start = "00:00";
    end = "00:01";
  }

  if (!day) {
    return { success: false, error: "Selecciona un día de la semana." };
  }
  if (!start || !end) {
    return { success: false, error: "Completa la hora de inicio y fin." };
  }
  if (start === end) {
    return { success: false, error: "La hora de inicio y fin no pueden ser iguales." };
  }

  const idempotencyKey = `shift-create:${day}:${start}:${end}:${type}`;

  try {
    await postToBackend<CreateShiftResponse>("/api/v1/shifts", {
      day,
      start,
      end,
      type,
      idempotency_key: idempotencyKey,
    });
    revalidatePath("/turnos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el turno",
    };
  }
}

export interface UpdateShiftResult {
  success: boolean;
  error?: string;
}

export async function updateShift(
  shiftId: string,
  formData: FormData
): Promise<UpdateShiftResult> {
  const day = (formData.get("day") as string) || "";
  const type = (formData.get("type") as string) || "work";
  let start = (formData.get("start") as string) || "";
  let end = (formData.get("end") as string) || "";

  if (type === "rest" || type === "travel") {
    start = "00:00";
    end = "00:01";
  }

  if (!day) {
    return { success: false, error: "Selecciona un día de la semana." };
  }
  if (!start || !end) {
    return { success: false, error: "Completa la hora de inicio y fin." };
  }
  if (start === end) {
    return { success: false, error: "La hora de inicio y fin no pueden ser iguales." };
  }

  try {
    await putToBackend<{ shift: Shift }>(`/api/v1/shifts/${shiftId}`, {
      day,
      start,
      end,
      type,
    });
    revalidatePath("/turnos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar el turno",
    };
  }
}

export async function deleteShift(shiftId: string) {
  try {
    await apiRequest("DELETE", `/api/v1/shifts/${shiftId}`);
    revalidatePath("/turnos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar el turno",
    };
  }
}

export async function getShiftConflicts(): Promise<any[]> {
  try {
    const res = await fetchFromBackend<{ conflicts: any[] }>("/api/v1/shifts");
    return res.conflicts ?? [];
  } catch {
    return [];
  }
}
