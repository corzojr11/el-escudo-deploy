"use server";

import { revalidatePath } from "next/cache";
import {
  fetchFromBackend,
  postToBackend,
  apiRequest,
} from "@/lib/api/server";
import type {
  ShiftListResponse,
  CurrentStatusResponse,
  CreateShiftResponse,
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
  const start = (formData.get("start") as string) || "";
  const end = (formData.get("end") as string) || "";

  if (!day) {
    return { success: false, error: "Selecciona un día de la semana." };
  }
  if (!start || !end) {
    return { success: false, error: "Completa la hora de inicio y fin." };
  }
  if (start >= end) {
    return { success: false, error: "La hora de inicio debe ser anterior a la de fin." };
  }

  try {
    await postToBackend<CreateShiftResponse>("/api/v1/shifts", {
      day,
      start,
      end,
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
