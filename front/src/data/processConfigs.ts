export type RiskLevel = "normal" | "low" | "mid" | "high"

export type FieldOption = { value: string; label: string }

export type FieldConfig = {
  key: string
  label: string
  unit?: string
  defaultValue: string
  options: FieldOption[]
}

export type ParamRange = {
  label: string
  low: string[]
  mid: string[] | null
}

type RawFieldConfig = {
  key: string
  label: string
  unit?: string
  options?: FieldOption[]
  defaultValue?: string
}

type RawProcessConfig = {
  value: string
  label: string
  fields: RawFieldConfig[]
  params: ParamRange[]
}

export type ProcessConfig = {
  value: string
  label: string
  fields: FieldConfig[]
  params: ParamRange[]
}

function parseRange(range: string): [number, number] {
  const [min, max] = range.split("~").map((part) => Number(part.trim()))
  return [min, max]
}

function formatNumber(num: number): string {
  return Number(num.toPrecision(3)).toString()
}

// 0이 많은 큰 수(예: 이온 공정의 가스 유량)는 지수 표기법(예: 2.97e+17)으로 표시한다.
export function formatSciNumber(value: string): string {
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return Math.abs(num) >= 1e6 ? num.toExponential(2) : value
}

// 추천 범위(저위험 기준) 안에서 4개, 두 저위험 구간 "사이"(boxplot의 box, 즉 불량이
// 몰려있는 구간)에서 고위험을 유발할 가능성이 높은 값 4개를 만들어 select 옵션을 생성한다.
function generateNumericOptionValues(ranges: string[]): string[] {
  const parsed = ranges.map(parseRange)
  const inRange: number[] = []

  if (parsed.length >= 2) {
    parsed.slice(0, 2).forEach(([min, max]) => {
      inRange.push(min + (max - min) * 0.3)
      inRange.push(min + (max - min) * 0.7)
    })

    const sorted = [...parsed].sort((a, b) => a[0] - b[0])
    const gapMin = sorted[0][1]
    const gapMax = sorted[1][0]
    const gapSpan = gapMax - gapMin
    const highRisk = [0.1, 0.35, 0.65, 0.9].map((ratio) => gapMin + gapSpan * ratio)

    return [...new Set([...inRange, ...highRisk].map(formatNumber))]
  }

  const [min, max] = parsed[0]
  const span = max - min
  const fallback = [
    min + span * 0.15,
    min + span * 0.4,
    min + span * 0.6,
    min + span * 0.85,
    min - span * 1.5,
    max + span * 1.5,
  ]

  return [...new Set(fallback.map(formatNumber))]
}

function withGeneratedOptions(process: RawProcessConfig): ProcessConfig {
  return {
    ...process,
    fields: process.fields.map((field, index) => {
      if (field.options) {
        return {
          ...field,
          defaultValue: field.defaultValue ?? field.options[0].value,
          options: field.options,
        }
      }

      const param = process.params[index]
      const values = generateNumericOptionValues(param.low)
      const options: FieldOption[] = values
        .map((value) => ({
          value,
          label: field.unit ? `${formatSciNumber(value)} ${field.unit}` : formatSciNumber(value),
        }))
        .sort((a, b) => Number(a.value) - Number(b.value))

      return {
        ...field,
        defaultValue: values[0],
        options,
      }
    }),
  }
}

const rawProcessConfigs: RawProcessConfig[] = [
  {
    value: "oxi",
    label: "산화 (Oxidation)",
    fields: [
      { key: "tempOxid", label: "산화 온도 (Temp Oxid)", unit: "°C" },
      { key: "pressure", label: "공정 압력 (Pressure)", unit: "Torr" },
      { key: "ppm", label: "가스 농도 (ppm)", unit: "ppm" },
      { key: "oxidTime", label: "산화 공정 시간 (Oxid time)", unit: "min" },
      {
        key: "type",
        label: "산화 방식 (Type)",
        defaultValue: "wet",
        options: [
          { value: "wet", label: "wet" },
          { value: "dry", label: "dry" },
        ],
      },
      {
        key: "thickness",
        label: "박막 두께 (Thickness)",
        unit: "Å",
        defaultValue: "711.68",
        options: [
          { value: "711.68", label: "711.68 Å" },
          { value: "500", label: "500 Å" },
          { value: "1000", label: "1000 Å" },
          { value: "1500", label: "1500 Å" },
        ],
      },
    ],
    params: [
      { label: "산화 온도 (Temp Oxid)", low: ["861.7900 ~ 883.8550", "1186.3200 ~ 1311.3200"], mid: ["861.7900 ~ 870.3600"] },
      { label: "공정 압력 (Pressure)", low: ["-0.0700 ~ 0.1500", "0.2800 ~ 0.4900"], mid: ["-0.0700 ~ -0.0400", "0.4600 ~ 0.4900"] },
      { label: "가스 농도 (ppm)", low: ["20.7500 ~ 25.1450", "38.5300 ~ 50.0900"], mid: ["20.7500 ~ 21.8000", "46.1600 ~ 50.0900"] },
      { label: "산화 공정 시간 (Oxid time)", low: ["-6.0000 ~ 32.0000", "160.0000 ~ 291.0000"], mid: ["-6.0000 ~ -5.0000", "241.0000 ~ 291.0000"] },
    ],
  },
  {
    value: "photo-softbake",
    label: "포토 (Photo-Softbake)",
    fields: [
      { key: "timeSoftbake", label: "소프트베이크 시간 (Time Softbake)", unit: "sec" },
      { key: "timeHmdsBake", label: "HMDS 베이크 시간 (Time HMDS bake)", unit: "sec" },
      { key: "tempHmds", label: "HMDS 처리 온도 (Temp HMDS)", unit: "°C" },
      { key: "spin3", label: "3차 스핀 코팅 속도 (Spin3)", unit: "rpm" },
      { key: "spin2", label: "2차 스핀 코팅 속도 (Spin2)", unit: "rpm" },
      { key: "spin1", label: "1차 스핀 코팅 속도 (Spin1)", unit: "rpm" },
      { key: "pressureHmds", label: "HMDS 공정 압력 (Pressure HMDS)", unit: "Torr" },
      { key: "photoresistBake", label: "포토레지스트 베이크 온도 (Photoresist bake)", unit: "°C" },
      { key: "n2Hmds", label: "HMDS 공정 질소 유량 (N2 HMDS)", unit: "sccm" },
      {
        key: "resistTarget",
        label: "레지스트 타겟 두께 (Resist target)",
        unit: "μm",
        defaultValue: "1.124",
        options: [
          { value: "1.124", label: "1.124 μm" },
          { value: "0.5", label: "0.5 μm" },
          { value: "5", label: "5 μm" },
          { value: "10", label: "10 μm" },
        ],
      },
      {
        key: "tempHmdsBake",
        label: "HMDS 베이크 온도 (Temp HMDS bake)",
        unit: "°C",
        defaultValue: "200.556",
        options: [
          { value: "200.556", label: "200.556 °C" },
          { value: "100", label: "100 °C" },
          { value: "0", label: "0 °C" },
          { value: "300", label: "300 °C" },
        ],
      },
    ],
    params: [
      { label: "소프트베이크 시간 (Time Softbake)", low: ["29.7290 ~ 29.9310", "30.0670 ~ 30.2700"], mid: ["29.7290 ~ 29.7320", "30.2680 ~ 30.2700"] },
      { label: "HMDS 베이크 시간 (Time HMDS bake)", low: ["89.7300 ~ 89.9310", "90.0640 ~ 90.2690"], mid: ["89.7300 ~ 89.7410", "90.2620 ~ 90.2690"] },
      { label: "HMDS 처리 온도 (Temp HMDS)", low: ["19.7310 ~ 19.9315", "20.0680 ~ 20.2700"], mid: ["19.7310 ~ 19.7330", "20.2680 ~ 20.2700"] },
      { label: "3차 스핀 코팅 속도 (Spin3)", low: ["4826.8710 ~ 4938.8615", "5047.6730 ~ 5194.3290"], mid: ["5172.2660 ~ 5194.3290"] },
      { label: "2차 스핀 코팅 속도 (Spin2)", low: ["3872.7480 ~ 3971.2520", "4055.7320 ~ 4156.4970"], mid: ["3872.7480 ~ 3879.3410", "4136.0410 ~ 4156.4970"] },
      { label: "1차 스핀 코팅 속도 (Spin1)", low: ["493.1040 ~ 497.1835", "502.2920 ~ 509.1290"], mid: null },
      { label: "HMDS 공정 압력 (Pressure HMDS)", low: ["14.6600 ~ 14.9190", "15.0840 ~ 15.3460"], mid: ["14.6600 ~ 14.6810", "15.3240 ~ 15.3460"] },
      { label: "포토레지스트 베이크 온도 (Photoresist bake)", low: ["4.6920 ~ 4.9160", "5.0825 ~ 5.3560"], mid: ["5.3190 ~ 5.3560"] },
      { label: "HMDS 공정 질소 유량 (N2 HMDS)", low: ["10.7660 ~ 14.5015", "17.4345 ~ 21.3170"], mid: ["20.9340 ~ 21.3170"] },
    ],
  },
  {
    value: "photo-litho",
    label: "포토 (Photo-Litho)",
    fields: [
      { key: "energyExposure", label: "노광 에너지 (Energy exposure)", unit: "mJ/cm²" },
      {
        key: "uvType",
        label: "UV 파장 종류 (UV type)",
        options: [
          { value: "g line", label: "g line" },
          { value: "i line", label: "i line" },
        ],
      },
      {
        key: "resolution",
        label: "해상도 (Resolution)",
        unit: "nm",
        defaultValue: "513.702",
        options: [
          { value: "513.702", label: "513.702 nm" },
          { value: "450", label: "450 nm" },
          { value: "500", label: "500 nm" },
          { value: "600", label: "600 nm" },
        ],
      },
      {
        key: "lineCd",
        label: "라인 CD (Line CD)",
        unit: "nm",
        defaultValue: "40.2105",
        options: [
          { value: "40.2105", label: "40.2105 nm" },
          { value: "20", label: "20 nm" },
          { value: "10", label: "10 nm" },
          { value: "60", label: "60 nm" },
        ],
      },
    ],
    params: [
      { label: "노광 에너지 (Energy exposure)", low: ["104.0290 ~ 106.9250", "109.3480 ~ 112.2230"], mid: ["111.7020 ~ 112.2230"] },
      { label: "UV 파장 종류 (UV type)", low: ["g line", "i line"], mid: null },
    ],
  },
  {
    value: "etching",
    label: "식각 (Etching)",
    fields: [
      { key: "thinF4", label: "박막 두께 F4 (Thin F4)", unit: "Å" },
      { key: "thinF3", label: "박막 두께 F3 (Thin F3)", unit: "Å" },
      { key: "thinF2", label: "박막 두께 F2 (Thin F2)", unit: "Å" },
      { key: "thinF1", label: "박막 두께 F1 (Thin F1)", unit: "Å" },
      { key: "sourcePower", label: "플라즈마 소스 전력 (Source Power)", unit: "W" },
    ],
    params: [
      { label: "박막 두께 F4 (Thin F4)", low: ["-49.0000 ~ 330.0000", "491.0000 ~ 589.0000"], mid: ["-49.0000 ~ 151.0000"] },
      { label: "박막 두께 F3 (Thin F3)", low: ["1219.0000 ~ 1466.0000", "1576.0000 ~ 1709.0000"], mid: ["1219.0000 ~ 1341.0000"] },
      { label: "박막 두께 F2 (Thin F2)", low: ["3609.0000 ~ 3657.0000", "3681.0000 ~ 3691.0000"], mid: ["3609.0000 ~ 3625.0000"] },
      { label: "박막 두께 F1 (Thin F1)", low: ["5669.0000 ~ 5703.0000", "5726.0000 ~ 5756.0000"], mid: ["5669.0000 ~ 5684.0000", "5750.0000 ~ 5756.0000"] },
      { label: "플라즈마 소스 전력 (Source Power)", low: ["49.4770 ~ 50.8695", "51.8735 ~ 52.8300"], mid: ["52.7710 ~ 52.8300"] },
    ],
  },
  {
    value: "ion",
    label: "이온 (Ion)",
    fields: [
      { key: "tempImplantation", label: "이온 주입 공정 온도 (Temp implantation)", unit: "°C" },
      { key: "inputEnergy", label: "투입 에너지 (Input energy)", unit: "eV" },
      { key: "furanceTemp", label: "퍼니스 온도 (Furance temp)", unit: "°C" },
      { key: "flux90s", label: "90초 시점 가스 유량 (Flux90s)", unit: "ions/cm²" },
      { key: "flux60s", label: "60초 시점 가스 유량 (Flux60s)", unit: "ions/cm²" },
      { key: "flux480s", label: "480초 시점 가스 유량 (Flux480s)", unit: "ions/cm²" },
      { key: "flux160s", label: "160초 시점 가스 유량 (Flux160s)", unit: "ions/cm²" },
    ],
    params: [
      { label: "이온 주입 공정 온도 (Temp implantation)", low: ["98.6350 ~ 102.2930", "104.7535 ~ 107.5470"], mid: ["98.6350 ~ 99.1770", "106.8920 ~ 107.5470"] },
      { label: "투입 에너지 (Input energy)", low: ["30526.7990 ~ 31517.0660", "32407.6185 ~ 33410.6930"], mid: ["32773.5420 ~ 33410.6930"] },
      { label: "퍼니스 온도 (Furance temp)", low: ["858.0000 ~ 880.0000", "912.0000 ~ 944.0000"], mid: ["858.0000 ~ 860.0000"] },
      { label: "90초 시점 가스 유량 (Flux90s)", low: ["-41200000000000000.0000 ~ 13100000000000000.0000", "113000000000000000.0000 ~ 238000000000000000.0000"], mid: ["-41200000000000000.0000 ~ -30100000000000000.0000", "196000000000000000.0000 ~ 238000000000000000.0000"] },
      { label: "60초 시점 가스 유량 (Flux60s)", low: ["1970000000000000.0000 ~ 8130000000000000.0000", "14700000000000000.0000 ~ 24000000000000000.0000"], mid: ["1970000000000000.0000 ~ 2440000000000000.0000", "21200000000000000.0000 ~ 24000000000000000.0000"] },
      { label: "480초 시점 가스 유량 (Flux480s)", low: ["297000000000000000.0000 ~ 299000000000000000.0000", "301000000000000000.0000 ~ 304000000000000000.0000"], mid: ["303000000000000000.0000 ~ 304000000000000000.0000"] },
      { label: "160초 시점 가스 유량 (Flux160s)", low: ["-69300000000000000.0000 ~ 157000000000000000.0000", "693000000000000000.0000 ~ 1270000000000000000.0000"], mid: ["-69300000000000000.0000 ~ 26639638.9360"] },
    ],
  },
]

export const processConfigs: ProcessConfig[] = rawProcessConfigs.map(withGeneratedOptions)

export function getRecommendedRanges(param: ParamRange, risk: RiskLevel): string[] | null {
  if (risk === "high") return null
  if (risk === "mid") return param.mid
  return param.low
}

export function isWithinRanges(value: string, ranges: string[] | null): boolean | null {
  if (!ranges || ranges.length === 0) return null

  if (ranges.some((range) => !range.includes("~"))) {
    return ranges.includes(value.trim())
  }

  const num = Number(value)
  if (Number.isNaN(num)) return null

  return ranges.some((range) => {
    const [min, max] = range.split("~").map((part) => Number(part.trim()))
    return num >= min && num <= max
  })
}
