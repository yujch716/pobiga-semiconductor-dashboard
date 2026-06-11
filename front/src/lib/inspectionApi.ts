import { API_BASE_URL } from "@/lib/predictionApi"

export const RISK_LABEL: Record<"mid" | "high", string> = {
  mid: "중위험",
  high: "고위험",
}

export type InspectionResultType = "discard" | "rework"

export type LogInspectionPayload = {
  lotNum: number
  waferNum: number
  waferCount: number
  appliedToAll: boolean
  process: string
  processLabel: string
  riskLevel: "mid" | "high"
  badProbPercent: number
  resultType?: InspectionResultType
}

export type InspectionRecord = {
  id: number
  lot_num: number
  wafer_num: number
  wafer_count: number
  applied_to_all: boolean
  process: string
  process_label: string
  risk_level: string
  bad_prob_percent: number
  result_type: InspectionResultType | null
  is_read: boolean
  created_at: string | null
}

export type InspectionListResponse = {
  items: InspectionRecord[]
  page: number
  per_page: number
  total: number
  pages: number
}

export async function logInspection(payload: LogInspectionPayload): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/inspections/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lot_num: payload.lotNum,
        wafer_num: payload.waferNum,
        wafer_count: payload.waferCount,
        applied_to_all: payload.appliedToAll,
        process: payload.process,
        process_label: payload.processLabel,
        risk_level: RISK_LABEL[payload.riskLevel],
        bad_prob_percent: payload.badProbPercent,
        result_type: payload.resultType ?? null,
      }),
    })
  } catch {
    // 이력 기록 실패는 검사 흐름을 막지 않는다.
  }
}

export async function fetchInspections(page = 1, perPage = 20): Promise<InspectionListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inspections/?page=${page}&per_page=${perPage}`)
  return response.json()
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/api/inspections/unread-count`)
  const data = await response.json()
  return data.count ?? 0
}

export async function markAllRead(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/inspections/mark-read`, { method: "POST" })
}
