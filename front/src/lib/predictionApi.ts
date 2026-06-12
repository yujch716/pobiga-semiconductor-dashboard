import type { FieldConfig, ProcessConfig, RiskLevel } from "@/data/processConfigs"

// bigdata conda 환경에서 실행되는 Flask 예측 API 서버 (backend/README.md 참고)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000"

export type PredictionResult = {
  riskLevel: RiskLevel
  badProbPercent: number
  isNormal: boolean
}

const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  "저위험": "normal",
  "중위험": "mid",
  "고위험": "high",
}

type FeatureValue = string | number

// 프론트 입력 필드 key -> 백엔드 모델 feature명
const FEATURE_MAP: Record<string, Record<string, string>> = {
  oxi: {
    tempOxid: "Temp_OXid",
    pressure: "Pressure",
    ppm: "ppm",
    oxidTime: "Oxid_time",
    type: "type",
    thickness: "thickness",
  },
  "photo-softbake": {
    timeSoftbake: "time_softbake",
    timeHmdsBake: "time_HMDS_bake",
    tempHmds: "temp_HMDS",
    spin3: "spin3",
    spin2: "spin2",
    spin1: "spin1",
    pressureHmds: "pressure_HMDS",
    photoresistBake: "photoresist_bake",
    n2Hmds: "N2_HMDS",
    resistTarget: "resist_target",
    tempHmdsBake: "temp_HMDS_bake",
  },
  "photo-litho": {
    energyExposure: "Energy_Exposure",
    resolution: "Resolution",
    lineCd: "Line_CD",
  },
  etching: {
    thinF4: "Thin F4",
    thinF3: "Thin F3",
    thinF2: "Thin F2",
    thinF1: "Thin F1",
    sourcePower: "Source_Power",
  },
  ion: {
    tempImplantation: "Temp_implantation",
    inputEnergy: "input_Energy",
    furanceTemp: "Furance_Temp",
    flux90s: "Flux90s",
    flux60s: "Flux60s",
    flux480s: "Flux480s",
    flux160s: "Flux160s",
  },
}

// 프론트 입력 폼에 없는 백엔드 필수 feature의 기본값
// 학습 데이터(modeling_merged.csv) 중앙값 기준 기본값
const EXTRA_DEFAULTS: Record<string, Record<string, FeatureValue>> = {
  oxi: {},
  "photo-softbake": { photo_soft_Chamber: 2, temp_softbake: 92.046 },
  "photo-litho": {},
  etching: { Temp_Etching: 71.208, Selectivity: 1.034 },
  ion: { Ion_Chamber: 2, Flux840s: 6e17, RTA_Temp: 155 },
}

// photo-litho UV_type 값 매핑 (프론트 "g line"/"i line" -> 백엔드 "G"/"I")
const UV_TYPE_MAP: Record<string, string> = {
  "g line": "G",
  "i line": "I",
}

export function buildPredictionPayload(
  process: ProcessConfig,
  getFieldValue: (field: FieldConfig) => string,
): Record<string, FeatureValue> {
  const payload: Record<string, FeatureValue> = {
    ...(EXTRA_DEFAULTS[process.value] ?? {}),
  }

  const featureMap = FEATURE_MAP[process.value] ?? {}

  for (const field of process.fields) {
    const value = getFieldValue(field)

    if (process.value === "photo-litho" && field.key === "uvType") {
      payload.UV_type = UV_TYPE_MAP[value] ?? value
      continue
    }

    const featureName = featureMap[field.key]
    if (!featureName) continue

    payload[featureName] = value
  }

  return payload
}

export class PredictionApiError extends Error {}

export async function predictProcess(
  processValue: string,
  payload: Record<string, FeatureValue>,
): Promise<PredictionResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/predict/${processValue}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new PredictionApiError("예측 서버에 연결할 수 없습니다. 백엔드 서버 실행 상태를 확인하세요.")
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new PredictionApiError(data?.error ?? "예측 요청 처리 중 오류가 발생했습니다.")
  }

  return {
    riskLevel: RISK_LEVEL_MAP[data.risk_level] ?? "normal",
    badProbPercent: data.bad_prob_percent,
    isNormal: data.is_normal,
  }
}
