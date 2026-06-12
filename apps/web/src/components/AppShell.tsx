"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardIcon, FilmIcon, MicIcon, PlusIcon, SparkIcon } from "./icons";

const navigation = [
  { href: "/", icon: DashboardIcon, label: "Visão geral" },
  { href: "/projects", icon: FilmIcon, label: "Projetos" },
  { href: "/voices", icon: MicIcon, label: "Vozes" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullScreenEditor =
    pathname.startsWith("/projects/") && pathname.endsWith("/edit");

  if (isFullScreenEditor) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>
            <strong>Open Video</strong>
            <small>Studio</small>
          </span>
        </Link>

        <Link
          className="button button-primary sidebar-create"
          href="/projects/new"
        >
          <PlusIcon />
          Novo vídeo
        </Link>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <span className="sidebar-label">Workspace</span>
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                className={active ? "nav-item active" : "nav-item"}
                href={item.href}
                key={item.href}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="plan-card">
            <span className="eyebrow">Ambiente local</span>
            <strong>Pipeline conectado</strong>
            <p>QwenProxy, render e storage prontos para produção.</p>
            <div className="service-status">
              <span /> Serviços ativos
            </div>
          </div>
          <div className="user-row">
            <span className="avatar">OV</span>
            <span>
              <strong>Operador</strong>
              <small>Workspace principal</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
