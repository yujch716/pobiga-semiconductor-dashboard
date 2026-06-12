import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { Bell, Factory, HistoryIcon, LayoutDashboard, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchUnreadCount } from "@/lib/inspectionApi"

const navItems = [
  { to: "/",         label: "대시보드",       icon: LayoutDashboard, end: true  },
  { to: "/alerts",   label: "공정 이상 알림",  icon: Bell,            end: false },
  { to: "/history",  label: "이상 발생 이력",  icon: HistoryIcon,     end: false },
  { to: "/settings", label: "설정",           icon: Settings,        end: false },
]

const pageTitles: Record<string, string> = {
  "/":         "대시보드",
  "/alerts":   "공정 이상 알림",
  "/history":  "이상 발생 이력",
  "/settings": "설정",
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? "공정 이상 감지 시스템"
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      fetchUnreadCount().then((count) => {
        if (!cancelled) setUnreadCount(count)
      })
    }

    refresh()
    const interval = setInterval(refresh, 5000)
    window.addEventListener("inspection-logged", refresh)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("inspection-logged", refresh)
    }
  }, [pathname])

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="px-5 py-5 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <Factory className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-sidebar-foreground">T 사</span>
                <span className="text-[10px] text-sidebar-foreground/60">반도체 공정 이상 감지 시스템</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 pt-4">
            <SidebarMenu>
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to} end={end}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        className="h-10 gap-3 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-8" />
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                A
              </div>
            </div>
          </header>

          <main className="flex-1 bg-muted/30 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
