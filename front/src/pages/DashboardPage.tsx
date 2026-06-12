import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, BellRing, Package, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx"

const kpiData = [
  {
    label: "전체 수율",
    value: "81.56%",
    description: "전월 대비 -0.8%p",
    icon: TrendingUp,
    valueClassName: "text-emerald-600",
    iconBoxClassName: "bg-emerald-100 text-emerald-600",
  },
  {
    label: "생산량",
    value: "12,480",
    description: "이번 주 생산량 (장)",
    icon: Package,
    valueClassName: "text-foreground",
    iconBoxClassName: "bg-blue-100 text-blue-600",
  },
  {
    label: "현재 불량률",
    value: "18.44%",
    description: "양품 대비 불량 비율",
    icon: AlertTriangle,
    valueClassName: "text-destructive",
    iconBoxClassName: "bg-rose-100 text-rose-600",
  },
  {
    label: "이상 알림 건수",
    value: "7건",
    description: "최근 24시간",
    icon: BellRing,
    valueClassName: "text-destructive",
    iconBoxClassName: "bg-amber-100 text-amber-600",
  },
]

const goodVsDefectData = [
  { name: "good", label: "양품", value: 82, fill: "var(--color-good)" },
  { name: "defect", label: "불량", value: 18, fill: "var(--color-defect)" },
]

const goodVsDefectConfig = {
  value: { label: "수량" },
  good: { label: "양품", color: "#16a34a" },
  defect: { label: "불량", color: "#dc2626" },
} satisfies ChartConfig

const yieldTrendData = [
  { date: "06/05", yield: 95.8 },
  { date: "06/06", yield: 96.1 },
  { date: "06/07", yield: 94.9 },
  { date: "06/08", yield: 96.5 },
  { date: "06/09", yield: 97.0 },
  { date: "06/10", yield: 95.6 },
  { date: "06/11", yield: 96.4 },
]

const yieldTrendConfig = {
  yield: { label: "수율 (%)", color: "#3B82F6" },
} satisfies ChartConfig

const chamberDefectData = [
  { chamber: "산화", count: 8 },
  { chamber: "포토(HMDS)", count: 5 },
  { chamber: "리소그래피", count: 12 },
  { chamber: "이온주입", count: 9 },
  { chamber: "식각", count: 12 },
]

const chamberDefectConfig = {
  count: { label: "불량 건수", color: "#f59e0b" },
} satisfies ChartConfig

const DashboardPage = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map(({ label, value, description, icon: Icon, valueClassName, iconBoxClassName }) => (
          <Card key={label} size="sm">
            <CardContent className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  iconBoxClassName
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-xl font-bold ${valueClassName}`}>{value}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 양품/불량 비교 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">양품/불량 비교</CardTitle>
            <CardDescription>최근 생산 웨이퍼 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={goodVsDefectConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                <Pie data={goodVsDefectData} dataKey="value" nameKey="name" innerRadius={60}>
                  {goodVsDefectData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 수율 추이 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">수율 추이</CardTitle>
            <CardDescription>최근 7일 일별 수율(%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={yieldTrendConfig} className="max-h-[250px] w-full">
              <LineChart data={yieldTrendData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  unit="%"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="yield"
                  type="monotone"
                  stroke="var(--color-yield)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 공정별 불량 발생 현황 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">공정별 불량 발생 현황</CardTitle>
            <CardDescription>챔버(공정)별 불량 발생 건수</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chamberDefectConfig} className="max-h-[250px] w-full">
              <BarChart data={chamberDefectData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="chamber" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage
