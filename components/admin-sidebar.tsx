"use client"

import * as React from "react"
import {
  GalleryVerticalEnd,
  LayoutDashboard,
  Command,
  ImageIcon,
  Sparkles,
  Settings,
  BarChartIcon,
  CircleChevronLeft,
} from "lucide-react"

import { AdminNavMain } from "@/components/admin-nav-main"
import { AdminNavUser } from "@/components/admin-nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin",
    email: "admin@example.com",
    avatar: "/avatars/default.jpg",
  },
  navMain: [
    {
      title: "Index",
      url: "#index",
      icon: LayoutDashboard,
      id: "index",
    },
    {
      title: "Navigation",
      url: "#navigation",
      icon: Command,
      id: "navigation",
    },
    {
      title: "Photos",
      url: "#photo",
      icon: ImageIcon,
      id: "photo",
    },
    {
      title: "Portfolio",
      url: "#portfolio",
      icon: Sparkles,
      id: "portfolio",
    },
    {
      title: "Stats",
      url: "#stat",
      icon: BarChartIcon,
      id: "stat",
    },
    {
      title: "Settings",
      url: "#settings",
      icon: Settings,
      id: "settings",
    },
  ],
}

export function AdminSidebar({
  onLogout,
  avatar,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onLogout?: () => void
  avatar?: string
}) {
  const { toggleSidebar, state } = useSidebar()

  const user = {
    ...data.user,
    avatar: avatar || data.user.avatar,
  }

  // Get current active page from URL hash
  const [currentPage, setCurrentPage] = React.useState(
    () => window.location.hash.replace('#', '') || 'index'
  )

  React.useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(window.location.hash.replace('#', '') || 'index')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
            >
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Admin Panel</span>
                  <span className="text-xs">v1.0.0</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AdminNavMain items={data.navMain} activePage={currentPage} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={state === "collapsed" ? "Expand" : "Collapse"}
            >
              <CircleChevronLeft className={`size-4 transition-transform duration-200 ${state === "collapsed" ? "rotate-180" : ""}`} />
              <span>Collapse</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <AdminNavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
