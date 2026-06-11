import { useState } from "react"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {Button} from "@/components/ui/button.tsx";
import {AlertTriangle, ArrowRight, Atom, CheckCircle2, Flame, Loader2, RefreshCw, ScanLine, SearchCheck, Sun, Trash2, Wrench, Zap} from "lucide-react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {cn} from "@/lib/utils";
import {
  type FieldConfig,
  getRecommendedRanges,
  isWithinRanges,
  processConfigs,
  type RiskLevel,
} from "@/data/processConfigs";
import {
  buildPredictionPayload,
  PredictionApiError,
  predictProcess,
  type PredictionResult,
} from "@/lib/predictionApi";
import { logInspection } from "@/lib/inspectionApi";

const riskLevelMeta: Record<RiskLevel, {
  label: string
  boxClass: string
  iconClass: string
  titleClass: string
  descClass: string
  icon: typeof CheckCircle2
  title: string
  description: string
}> = {
  normal: {
    label: "정상",
    boxClass: "border-green-200 bg-green-50",
    iconClass: "text-green-600",
    titleClass: "text-green-700",
    descClass: "text-green-600",
    icon: CheckCircle2,
    title: "정상",
    description: "입력된 값이 정상 범위 내에 있습니다. 아래 추천 범위를 참고하세요.",
  },
  low: {
    label: "저위험",
    boxClass: "border-blue-200 bg-blue-50",
    iconClass: "text-blue-600",
    titleClass: "text-blue-700",
    descClass: "text-blue-600",
    icon: CheckCircle2,
    title: "주의 (저위험)",
    description: "경미한 위험이 감지되었습니다. 아래 추천 범위를 참고해 공정 변수를 조정하세요.",
  },
  mid: {
    label: "중위험",
    boxClass: "border-amber-200 bg-amber-50",
    iconClass: "text-amber-600",
    titleClass: "text-amber-700",
    descClass: "text-amber-600",
    icon: AlertTriangle,
    title: "주의 (중위험)",
    description: "정상 범위를 벗어났습니다. 아래 추천 범위로 공정 변수를 조정하세요.",
  },
  high: {
    label: "고위험",
    boxClass: "border-red-200 bg-red-50",
    iconClass: "text-red-600",
    titleClass: "text-red-700",
    descClass: "text-red-600",
    icon: Trash2,
    title: "위험 (고위험)",
    description: "정상 범위를 크게 벗어났습니다. 해당 웨이퍼를 폐기하세요.",
  },
}

const pendingMeta = {
  boxClass: "border-border bg-muted/30",
  iconClass: "text-muted-foreground",
  titleClass: "text-foreground",
  descClass: "text-muted-foreground",
  icon: SearchCheck,
  title: "확인 대기",
  description: "공정 데이터를 입력하고 '이상 여부 확인' 버튼을 눌러주세요.",
}

const EDS_LABEL = "품질검사 (EDS)"

const TOTAL_LOTS = 32
const TOTAL_WAFERS = 54
const REWORKABLE_PROCESSES = ["photo-softbake", "photo-litho"]

const processSteps = [
  { value: "oxi", icon: Flame },
  { value: "photo-softbake", icon: Sun },
  { value: "photo-litho", icon: ScanLine },
  { value: "etching", icon: Zap },
  { value: "ion", icon: Atom },
  { value: "eds", icon: SearchCheck },
] as const

// 공정 데이터 입력의 라인 라벨을 그대로 사용해 두 곳의 라벨이 어긋나지 않도록 한다.
const processStepLabels: Record<string, string> = {
  ...Object.fromEntries(processConfigs.map((p) => [p.value, p.label])),
  eds: EDS_LABEL,
}

const processStateStyles = {
  idle: {
    card: "border-border bg-muted/30",
    icon: "bg-muted text-muted-foreground",
    label: "text-foreground",
    message: "text-muted-foreground",
    text: "대기중",
  },
  normal: {
    card: "border-blue-200 bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    label: "text-blue-900",
    message: "text-blue-600",
    text: "정상",
  },
  alert: {
    card: "border-red-200 bg-red-50",
    icon: "bg-red-100 text-red-600",
    label: "text-red-900",
    message: "text-red-600",
    text: "문제 발생",
  },
} as const

// 폐기된 웨이퍼를 건너뛰고 다음으로 작업할 웨이퍼 번호를 찾는다. 더 이상 없으면 null.
const findNextActiveWafer = (current: number, discarded: Set<number>): number | null => {
  for (let w = current + 1; w <= TOTAL_WAFERS; w++) {
    if (!discarded.has(w)) return w
  }
  return null
}

// 새 공정을 시작할 때 1번 웨이퍼부터(폐기되지 않았다면) 작업할 웨이퍼 번호를 찾는다.
const findFirstActiveWafer = (discarded: Set<number>): number => {
  for (let w = 1; w <= TOTAL_WAFERS; w++) {
    if (!discarded.has(w)) return w
  }
  return 1
}

type LotWaferStackProps = {
  lotNum: number
  totalLots: number
  waferNum: number
  totalWafers: number
  discardedWafers: Set<number>
}

// 추천 범위 문자열에 포함된 소수점 숫자를 소수점 첫째 자리까지 반올림해 표시한다.
const formatRange = (range: string): string =>
  range.replace(/-?\d+\.\d+/g, (num) => Number(num).toFixed(1))

// 로트(사각형 박스) 안에 웨이퍼 2장씩 묶어 얇은 막대로 세로로 쌓아 표현하는 시각화
const LotWaferStack = ({ lotNum, totalLots, waferNum, totalWafers, discardedWafers }: LotWaferStackProps) => {
  const groupCount = Math.ceil(totalWafers / 2)
  const groups = Array.from({ length: groupCount }, (_, i) => [i * 2 + 1, i * 2 + 2])

  return (
    <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 bg-white">
      <span className="text-sm font-bold text-primary">로트 {lotNum} / {totalLots}</span>
      <div className="flex flex-col-reverse gap-px rounded border bg-background p-3">
        {groups.map(([w1, w2]) => (
          <div
            key={w1}
            className={cn(
              "h-[3px] w-full rounded-sm",
              w1 === waferNum || w2 === waferNum
                ? "bg-blue-300"
                : discardedWafers.has(w1) || discardedWafers.has(w2)
                  ? "bg-red-300"
                  : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-center text-xs text-muted-foreground">웨이퍼 {waferNum} / {totalWafers}</span>
    </div>
  )
}

const AlertPage = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, PredictionResult>>({})
  const [allCompleted, setAllCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [lotNum] = useState(1)
  const [waferNum, setWaferNum] = useState(1)
  const [discardedWafers, setDiscardedWafers] = useState<Set<number>>(new Set())
  const [reworkCounts, setReworkCounts] = useState<Record<string, number>>({})
  const [pendingRiskLevel, setPendingRiskLevel] = useState<RiskLevel | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const currentProcess = processConfigs[currentIndex]
  const currentResult = results[currentProcess.value]
  const effectiveRiskLevel: RiskLevel = currentResult?.riskLevel ?? "normal"
  const meta = currentResult ? riskLevelMeta[effectiveRiskLevel] : pendingMeta
  const StatusIcon = meta.icon

  const isLastProcess = currentIndex === processConfigs.length - 1
  const isReworkable = REWORKABLE_PROCESSES.includes(currentProcess.value)
  const reworkCount = reworkCounts[currentProcess.value] ?? 0
  const checkDisabled = isLoading || dialogOpen || effectiveRiskLevel === "high"
  const discardDisabled = effectiveRiskLevel !== "high" || isLoading || dialogOpen

  const getFieldValue = (field: FieldConfig) =>
    fieldValues[`${currentProcess.value}-${field.key}`] ?? field.defaultValue

  const setFieldValue = (field: FieldConfig, value: string) =>
    setFieldValues((prev) => ({ ...prev, [`${currentProcess.value}-${field.key}`]: value }))

  const clearCurrentResult = () => {
    setResults((prev) => {
      const next = { ...prev }
      delete next[currentProcess.value]
      return next
    })
  }

  const advanceToNextProcess = (discarded: Set<number>) => {
    if (isLastProcess) {
      setAllCompleted(true)
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setWaferNum(findFirstActiveWafer(discarded))
    setErrorMessage(null)
  }

  const handleCheck = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const payload = buildPredictionPayload(currentProcess, getFieldValue)
      const result = await predictProcess(currentProcess.value, payload)
      setResults((prev) => ({ ...prev, [currentProcess.value]: result }))

      if (result.riskLevel !== "high") {
        setPendingRiskLevel(result.riskLevel)
        setDialogOpen(true)
      }
      // 고위험인 경우 폐기/재작업 버튼을 눌러야 다음 웨이퍼로 진행한다.
    } catch (error) {
      setErrorMessage(
        error instanceof PredictionApiError
          ? error.message
          : "예측 요청 중 알 수 없는 오류가 발생했습니다."
      )
    } finally {
      setIsLoading(false)
    }
  }

  // 정상/중위험: '예' -> 같은 로트의 나머지 웨이퍼 전체 적용 후 다음 공정으로 이동
  const handleApplyToAllWafers = async () => {
    if (pendingRiskLevel === "mid" && currentResult) {
      await logInspection({
        lotNum,
        waferNum,
        waferCount: TOTAL_WAFERS - waferNum + 1,
        appliedToAll: true,
        process: currentProcess.value,
        processLabel: currentProcess.label,
        riskLevel: "mid",
        badProbPercent: currentResult.badProbPercent,
      })
    }
    setDialogOpen(false)
    setPendingRiskLevel(null)
    advanceToNextProcess(discardedWafers)
  }

  // 정상/중위험: '아니오' -> 다음 웨이퍼의 이상 여부를 다시 확인
  const handleCheckNextWaferOnly = async () => {
    if (pendingRiskLevel === "mid" && currentResult) {
      await logInspection({
        lotNum,
        waferNum,
        waferCount: 1,
        appliedToAll: false,
        process: currentProcess.value,
        processLabel: currentProcess.label,
        riskLevel: "mid",
        badProbPercent: currentResult.badProbPercent,
      })
    }
    setDialogOpen(false)
    setPendingRiskLevel(null)

    const next = findNextActiveWafer(waferNum, discardedWafers)
    if (next === null) {
      advanceToNextProcess(discardedWafers)
    } else {
      setWaferNum(next)
      clearCurrentResult()
    }
  }

  // 고위험: 폐기/재작업 처리 후 현재 웨이퍼 번호 +1
  const handleDiscardOrRework = async () => {
    if (!currentResult || currentResult.riskLevel !== "high") return

    await logInspection({
      lotNum,
      waferNum,
      waferCount: 1,
      appliedToAll: false,
      process: currentProcess.value,
      processLabel: currentProcess.label,
      riskLevel: "high",
      badProbPercent: currentResult.badProbPercent,
      resultType: isReworkable ? "rework" : "discard",
    })

    let updatedDiscarded = discardedWafers
    if (isReworkable) {
      setReworkCounts((prev) => ({
        ...prev,
        [currentProcess.value]: (prev[currentProcess.value] ?? 0) + 1,
      }))
    } else {
      updatedDiscarded = new Set(discardedWafers)
      updatedDiscarded.add(waferNum)
      setDiscardedWafers(updatedDiscarded)
    }

    const next = findNextActiveWafer(waferNum, updatedDiscarded)
    if (next === null) {
      advanceToNextProcess(updatedDiscarded)
    } else {
      setWaferNum(next)
      clearCurrentResult()
    }
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setFieldValues({})
    setResults({})
    setAllCompleted(false)
    setErrorMessage(null)
    setWaferNum(1)
    setDiscardedWafers(new Set())
    setReworkCounts({})
    setPendingRiskLevel(null)
    setDialogOpen(false)
  }

  const getStepState = (value: string): keyof typeof processStateStyles => {
    if (value === "eds") return allCompleted ? "normal" : "idle"
    const result = results[value]
    if (!result) return "idle"
    return result.isNormal ? "normal" : "alert"
  }

  const getStepText = (value: string, state: keyof typeof processStateStyles) => {
    if (value === "eds" && allCompleted) return "검사 완료"
    return processStateStyles[state].text
  }

  const highlightedStep = allCompleted ? "eds" : currentProcess.value

  return (
    <div className="flex flex-col gap-6">
      {/* 로트/웨이퍼 시각화 + 공정 흐름 */}
      <div className="grid grid-cols-6 gap-6">
        <LotWaferStack
          lotNum={lotNum}
          totalLots={TOTAL_LOTS}
          waferNum={waferNum}
          totalWafers={TOTAL_WAFERS}
          discardedWafers={discardedWafers}
        />
        <Card className="col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">공정 흐름</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-1">
              {processSteps.map((step, i) => {
                const Icon = step.icon
                const state = getStepState(step.value)
                const styles = processStateStyles[state]
                const isSelected = step.value === highlightedStep
                return (
                  <div key={step.value} className="flex items-center gap-1">
                    <div
                      className={cn(
                        "flex min-w-[104px] flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium shadow-sm",
                        styles.card,
                        isSelected && "ring-2 ring-primary ring-offset-2"
                      )}
                    >
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", styles.icon)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className={styles.label}>{processStepLabels[step.value]}</span>
                      <span className={cn("flex items-center gap-1 text-[10px] font-normal", styles.message)}>
                        {state === "idle" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                        {getStepText(step.value, state)}
                      </span>
                    </div>
                    {i < processSteps.length - 1 && (
                      <ArrowRight className="mx-2 h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상단 2열 카드 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 공정 데이터 입력 */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">공정 인자 입력</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-[11px] text-muted-foreground">현재 공정 ({currentIndex + 1}/{processConfigs.length})</p>
                <p className="text-sm font-semibold">{currentProcess.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {currentProcess.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Select value={getFieldValue(field)} onValueChange={(value) => setFieldValue(field, value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCheck} disabled={checkDisabled}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 확인 중...
                  </>
                ) : (
                  "이상 여부 확인"
                )}
              </Button>
              <Button className="flex-1" variant="destructive" onClick={handleDiscardOrRework} disabled={discardDisabled}>
                {isReworkable ? <Wrench className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                {isReworkable ? "재작업 등록" : "폐기 처리"}
              </Button>
            </div>

            {errorMessage && (
              <p className="text-[11px] text-red-600">⚠ {errorMessage}</p>
            )}

            {isReworkable && reworkCount > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700">재작업 필요 웨이퍼 {reworkCount}장</p>
                  <p className="text-xs text-amber-600">
                    이 로트에서 재작업이 필요한 웨이퍼 {reworkCount}장을 모아 별도로 재작업할 수 있습니다.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  재작업 진행
                </Button>
              </div>
            )}

            {allCompleted && (
              <Button variant="outline" className="w-full" onClick={handleReset}>
                <RefreshCw className="h-4 w-4" /> 새로고침 (처음부터 다시 입력)
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground">
              💡 <strong>알림 처리:</strong> 이상이 감지되었을 시 즉시 알림이 전송됩니다.
            </p>
          </CardContent>
        </Card>

        {/* 이상 여부 결과 */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">이상 여부 결과</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className={cn("flex items-start gap-3 rounded-lg border p-3", meta.boxClass)}>
              <StatusIcon className={cn("mt-0.5 h-5 w-5 shrink-0", meta.iconClass)} />
              <div>
                <p className={cn("text-sm font-semibold", meta.titleClass)}>
                  {meta.title}
                  {currentResult ? ` (불량 확률 ${currentResult.badProbPercent}%)` : ""}
                </p>
                <p className={cn("text-xs", meta.descClass)}>{meta.description}</p>
              </div>
            </div>

            {effectiveRiskLevel === "high" ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {isReworkable ? "재작업 대상 웨이퍼" : "웨이퍼 폐기 대상"}
                  </p>
                  <p className="text-xs text-red-600">
                    {isReworkable
                      ? "이 웨이퍼는 정상 범위를 크게 벗어났습니다. 폐기하지 않고 재작업 대상으로 분류되었습니다. '재작업 등록' 버튼을 눌러 다음 웨이퍼로 진행하세요."
                      : "이 웨이퍼는 정상 범위를 크게 벗어났습니다. '폐기 처리' 버튼을 눌러 다음 웨이퍼로 진행하세요."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground pt-1">추천 범위</p>
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">인자</TableHead>
                    <TableHead className="text-xs">현재 값</TableHead>
                    <TableHead className="text-xs">추천 범위</TableHead>
                    <TableHead className="text-xs text-center">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProcess.params.map((param, index) => {
                    const ranges = getRecommendedRanges(param, effectiveRiskLevel)
                    const field = currentProcess.fields[index]
                    const currentValue = field ? getFieldValue(field) : undefined
                    const inRange = currentValue !== undefined ? isWithinRanges(currentValue, ranges) : null

                    return (
                      <TableRow key={param.label}>
                        <TableCell className="py-2 text-xs font-medium">{param.label}</TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {currentValue}
                          {field?.unit ? ` ${field.unit}` : ""}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {ranges && ranges.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {ranges.map((range) => (
                                <Badge
                                  key={range}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-normal",
                                    effectiveRiskLevel === "normal" || effectiveRiskLevel === "low"
                                      ? "border-blue-300 bg-blue-50 text-blue-700"
                                      : "border-amber-300 bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {formatRange(range)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">권장 범위 없음</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {inRange === null ? (
                            <Badge variant="outline" className="border-border bg-muted text-[10px] text-muted-foreground">
                              확인불가
                            </Badge>
                          ) : inRange ? (
                            <Badge variant="outline" className="border-green-300 bg-green-50 text-[10px] text-green-700">
                              정상
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-300 bg-red-50 text-[10px] text-red-700">
                              이상
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>동일 로트에 동일하게 적용할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              현재 웨이퍼({waferNum}번)의 판정 결과를 같은 로트({lotNum})의 나머지 웨이퍼({waferNum}~{TOTAL_WAFERS}번)에도
              동일하게 적용하시겠습니까? '예'를 선택하면 다음 공정으로 이동합니다.
              '아니오'를 선택하면 다음 웨이퍼의 이상 여부를 다시 확인합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCheckNextWaferOnly}>아니오</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyToAllWafers}>예</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
export default AlertPage;
