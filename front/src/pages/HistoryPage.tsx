import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchInspections, markAllRead, type InspectionRecord } from "@/lib/inspectionApi"

const riskBadgeClass: Record<string, string> = {
  "중위험": "border-amber-300 bg-amber-50 text-amber-700",
  "고위험": "border-red-300 bg-red-50 text-red-700",
}

const resultTypeLabel: Record<string, string> = {
  discard: "폐기",
  rework: "재작업",
}

const formatWaferRange = (record: InspectionRecord) => {
  if (record.wafer_count > 1) {
    const end = record.wafer_num + record.wafer_count - 1
    return `${record.wafer_num}~${end}번 (${record.wafer_count}장)`
  }
  return `${record.wafer_num}번`
}

const formatDateTime = (value: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ko-KR")
}

const HistoryPage = () => {
  const [items, setItems] = useState<InspectionRecord[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void markAllRead()
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchInspections(page)
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setPages(Math.max(data.pages, 1))
        setTotal(data.total)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">이상 발생 이력</CardTitle>
          <CardDescription>중위험/고위험으로 판정된 웨이퍼 검사 기록입니다. (총 {total}건)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">이상 발생 이력이 없습니다.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">발생 시각</TableHead>
                    <TableHead className="text-xs">공정</TableHead>
                    <TableHead className="text-xs">로트 / 웨이퍼</TableHead>
                    <TableHead className="text-xs">위험도</TableHead>
                    <TableHead className="text-xs">불량 확률</TableHead>
                    <TableHead className="text-xs">처리</TableHead>
                    <TableHead className="text-xs">동일 로트 적용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="py-2 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</TableCell>
                      <TableCell className="py-2 text-xs font-medium">{item.process_label}</TableCell>
                      <TableCell className="py-2 text-xs">
                        로트 {item.lot_num} · 웨이퍼 {formatWaferRange(item)}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <Badge variant="outline" className={cn("text-[10px] font-normal", riskBadgeClass[item.risk_level])}>
                          {item.risk_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{item.bad_prob_percent}%</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {item.result_type ? resultTypeLabel[item.result_type] ?? item.result_type : "-"}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {item.applied_to_all ? "예" : "아니오"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    이전
                  </Button>
                  <span className="text-xs text-muted-foreground">{page} / {pages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                    disabled={page >= pages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default HistoryPage
