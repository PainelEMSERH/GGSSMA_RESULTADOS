"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { UserButton } from "@clerk/nextjs";
import ThemeSwitcherGeist from "@/components/components/ThemeSwitcherGeist";
import ChatWidget from "@/components/chat/ChatWidget";
import {
  LayoutDashboard,
  PackageCheck,
  Boxes,
  BarChart3,
  Settings,
  AlertTriangle,
  Flame,
  FileText,
  Shield,
  Users,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "VISÃO GERAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
      { label: "Estoque SESMT", href: "/estoque", icon: Boxes },
    ],
  },
  {
    label: "Indicadores",
    items: [
      { label: "Acidentes", href: "/acidentes", icon: AlertTriangle },
      { label: "Extintores", href: "/spci-extintores", icon: Flame },
      { label: "Entregas", href: "/entregas", icon: PackageCheck },
      { label: "Ordens de Serviço", href: "/ordens-de-servico", icon: FileText },
      { label: "CIPA", href: "/cipa", icon: Users },
    ],
  },
  {
    label: "ADMINISTRAÇÃO",
    items: [
      { label: "Admin", href: "/admin", icon: Shield },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-bg/50">
      <div className="px-4 py-5 text-sm font-semibold tracking-wide text-text">
        Menu
      </div>
      <nav className="flex flex-col px-2 pb-6 gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  (item.href === "/dashboard" && pathname === "/dashboard") ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none",
                      "transition-[background-color,color,box-shadow] duration-100 ease-out",
                      active
                        ? "bg-panel text-text ring-1 ring-inset ring-border"
                        : "text-muted hover:bg-panel hover:text-text hover:shadow-sm active:bg-panel/90 active:opacity-95"
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 w-full border-b border-border bg-panel/80 backdrop-blur px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400">● Conectado</span>
            <div className="flex items-center gap-3">
              <ThemeSwitcherGeist />
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="p-6 max-w-full overflow-x-hidden">{children}</div>
      </main>
      <ChatWidget />
    </div>
  );
}
