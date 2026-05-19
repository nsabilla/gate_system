import React, { useEffect, useMemo, useState } from 'react';
import {
  Menu,
  X,
  Home,
  ChevronRight,
  PlusCircle,
  LogOut,
  ClipboardList,
  Folder,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

/* ================= TYPES ================= */
type MenuItem = {
  id: string;
  label: string;
  path?: string;
  icon: React.ElementType;
  roles?: string[];
  permissions?: Array<"rfq_crud" | "rfq_approve" | "pfs_crud" | "pfs_approve">;
  children?: MenuItem[];
};

/* ================= MENU CONFIG ================= */
const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    icon: Home,
    label: 'Home',
    path: 'dashboard',
  },
  {
    id: 'transaction',
    icon: Folder,
    label: 'Transaction',
    children: [
      {
        id: 'create-rfq',
        icon: PlusCircle,
        label: 'Create RFQ',
        path: 'create-rfq',
        permissions: ['rfq_crud'],
      },
      {
        id: 'rfq-list',
        icon: ClipboardList,
        label: 'RFQ List',
        path: 'rfq-list',
      },
      {
        id: 'manage-rfq',
        icon: ClipboardList,
        label: 'Manage RFQ',
        path: 'manage-rfq',
        permissions: ['rfq_crud'],
      },
      {
        id: 'activity-dashboard',
        icon: ClipboardList,
        label: 'Activity Dashboard',
        path: 'activity-dashboard',
        roles: ['marketing', 'engineering', 'admin'],
      },
  
      {
        id: 'summary-feasibility',
        icon: ClipboardList,
        label: 'Feasibility Summary',
        path: 'feasibility',
        roles: ['marketing'],
      },
      {
        id: 'master-activity',
        icon: ClipboardList,
        label: 'Master Activity',
        path: 'master-activity',
        permissions: ['rfq_crud'],
      },
      {
        id: 'drawing-documents',
        icon: ClipboardList,
        label: 'Drawing Documents',
        path: 'vendor-price-outhouse',
        roles: ['purchasing', 'admin'],
      },
      {
        id: 'create-standard-cost',
        icon: ClipboardList,
        label: 'Create Standard Cost',
        path: 'standard-cost',
        roles: ['purchasing', 'accounting', 'admin', 'marketing'],
      },
      {
        id: 'standard-cost-master',
        icon: ClipboardList,
        label: 'Master Standard Cost',
        path: 'standard-cost-master',
        roles: ['accounting', 'admin'],
      },
    ],
  },
  {
    id: 'pfs',
    icon: ClipboardList,
    label: 'Create PFS',
    roles: ['engineering', 'admin'],
    children: [
      {
        id: 'pfs-forging',
        icon: ClipboardList,
        label: 'Forging',
        path: 'pfs/forging',
        roles: ['engineering', 'admin'],
      },
      {
        id: 'pfs-jack',
        icon: ClipboardList,
        label: 'Jack',
        path: 'pfs/jack',
        roles: ['engineering', 'admin'],
      },
      {
        id: 'pfs-toolset',
        icon: ClipboardList,
        label: 'Toolset',
        path: 'pfs/toolset',
        roles: ['engineering', 'admin'],
      },
    ],
  },
];

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, loading: authLoading, logout } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>('transaction');
  const loading = authLoading;

  const hasAnyPermission = (
    permissions?: Array<"rfq_crud" | "rfq_approve" | "pfs_crud" | "pfs_approve">
  ) => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some((key) => Boolean(user?.permissions?.[key]));
  };

  type BreadcrumbItem = { label: string; to?: string };

  const selectedRfqLabel = useMemo(() => {
    // selection label comes from URL so header/title/breadcrumb stay in sync
    const sp = new URLSearchParams(location.search || '');
    const fromQuery = (sp.get('rfq_no') || '').trim();
    return fromQuery;
  }, [location.search]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const closeSidebarAfterSelect = () => {
    if (isMobile) {
      setMobileSidebarOpen(false);
      return;
    }
    setSidebarOpen(false);
  };

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    await logout();
  };

  /* ================= ROLE FILTER ================= */
  const visibleMenus = useMemo(() => {
    if (!user) return [];

    return MENU_ITEMS.map((menu) => {
      if (!menu.children) return menu;

      const visibleChildren = menu.children.filter(
        (c) => (!c.roles || c.roles.includes(user.role)) && hasAnyPermission(c.permissions)
      );

      return { ...menu, children: visibleChildren };
    }).filter(
      (menu) =>
        ((!menu.roles || menu.roles.includes(user.role)) && hasAnyPermission(menu.permissions)) ||
        (menu.children && menu.children.length > 0)
    );
  }, [user]);

  const routeSegment = useMemo(() => {
    const raw = location.pathname.split('?')[0].split('#')[0];
    const withoutMain = raw.startsWith('/main') ? raw.replace(/^\/main\/?/, '') : raw;
    return (withoutMain.split('/')[0] || '').trim();
  }, [location.pathname]);

  useEffect(() => {
    // auto open parent menu when a child route is active
    for (const menu of MENU_ITEMS) {
      if (menu.children?.some((c) => c.path === routeSegment)) {
        setOpenMenu(menu.id);
        return;
      }
    }
  }, [routeSegment]);

  const userInitial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  const { pageTitle, breadcrumbs } = useMemo(() => {
    const fallbackHome: BreadcrumbItem = { label: 'Home', to: '/main/dashboard' };

    const findMatch = (items: MenuItem[]) => {
      for (const menu of items) {
        if (menu.path && menu.path === routeSegment) {
          return { current: menu, parent: undefined as MenuItem | undefined };
        }
        if (menu.children) {
          for (const child of menu.children) {
            if (child.path && child.path === routeSegment) {
              return { current: child, parent: menu };
            }
          }
        }
      }
      return null;
    };

    const match = findMatch(MENU_ITEMS);

    // Extra routes not present in MENU_ITEMS
    const extraTitleBySegment: Record<string, string> = {
      users: 'Users',
    };

    let pageTitle = 'RFQ MTM';
    let breadcrumbs: BreadcrumbItem[] = [fallbackHome];

    if (routeSegment === '' || routeSegment === 'dashboard') {
      pageTitle = 'Home';
      breadcrumbs = [{ label: 'Home' }];
    } else if (match) {
      const currentLabel = match.current.label;
      const crumbs: BreadcrumbItem[] = [fallbackHome];
      if (match.parent) {
        const parentTo = match.parent.children?.find((c) => c.path)?.path;
        crumbs.push({
          label: match.parent.label,
          to: parentTo ? `/main/${parentTo}` : undefined,
        });
      }
      crumbs.push({ label: currentLabel });
      pageTitle = currentLabel;
      breadcrumbs = crumbs;
    } else {
      const extraTitle = extraTitleBySegment[routeSegment];
      if (extraTitle) {
        pageTitle = extraTitle;
        breadcrumbs = [fallbackHome, { label: extraTitle }];
      }
    }

    // If user selected an RFQ inside the page, reflect it in title/breadcrumb via URL.
    if (
      selectedRfqLabel &&
      (routeSegment === 'rfq-list' || routeSegment === 'manage-rfq' || routeSegment === 'pfs')
    ) {
      pageTitle = `${pageTitle} • ${selectedRfqLabel}`;
      breadcrumbs = [...breadcrumbs, { label: selectedRfqLabel }];
    }

    return { pageTitle, breadcrumbs };
  }, [routeSegment, selectedRfqLabel]);

  useEffect(() => {
    const title = pageTitle ? `${pageTitle} | RFQ MTM` : 'RFQ MTM';
    if (document.title !== title) document.title = title;
  }, [pageTitle]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const isSidebarExpanded = isMobile ? true : sidebarOpen;

  /* ================= RENDER ================= */
  return (
    <>
      <div className="flex h-screen bg-gray-50">
        {/* ================= MOBILE OVERLAY ================= */}
        {isMobile && mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
        )}

        {/* ================= SIDEBAR ================= */}
        <aside
          className={`${isMobile
              ? `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
              : sidebarOpen
                ? 'w-72'
                : 'w-20'
            } bg-white border-r border-gray-200 transition-[width,transform] duration-300 flex flex-col shadow-sm`}
        >
          {/* Branding */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {isSidebarExpanded && (
             <span className="text-[12px] font-bold tracking-wide text-[#0D79BD]">
  New Project Development Gate System - MTM
</span>
            )}
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileSidebarOpen(false);
                  return;
                }
                setSidebarOpen((v) => !v);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0D79BD]/30"
            >
              {isMobile ? <X size={20} /> : sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {isSidebarExpanded && (
            <div className="p-4 border-b border-gray-200 flex justify-center">
              <img
                src="/MTMhd.png"
                alt="MTM Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
          )}

          {/* ================= NAV ================= */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleMenus.map((menu) => {
              const Icon = menu.icon;

              // ===== MENU DENGAN SUBMENU =====
              if (menu.children) {
                const isOpen = openMenu === menu.id;
                const isChildActive = menu.children.some((child) =>
                  location.pathname.includes(`/main/${child.path}`)
                );

                return (
                  <div key={menu.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`submenu-${menu.id}`}
                      title={!sidebarOpen ? menu.label : undefined}
                      onClick={() => {
                        if (!isSidebarExpanded) {
                          setSidebarOpen(true);
                          setOpenMenu(menu.id);
                          return;
                        }
                        setOpenMenu(isOpen ? null : menu.id);
                      }}
                      className={`group flex w-full items-center rounded-xl py-3 text-sm font-semibold text-gray-700 transition-colors
                        ${isSidebarExpanded ? 'gap-3 px-4' : 'justify-center px-2'}
                        ${isChildActive ? 'bg-[#0D79BD]/10 text-[#0D79BD]' : 'hover:bg-gray-100'}`}
                    >
                      <span
                        className={`grid place-items-center rounded-lg p-2 transition-colors
                          ${isChildActive ? 'bg-[#0D79BD]/10' : 'bg-gray-50 group-hover:bg-gray-100'}`}
                      >
                        <Icon size={18} />
                      </span>
                      {isSidebarExpanded && (
                        <>
                          <span className="flex-1 text-left">
                            {menu.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {isOpen ? '▾' : '▸'}
                          </span>
                        </>
                      )}
                    </button>

                    {isOpen && isSidebarExpanded && (
                      <div id={`submenu-${menu.id}`} className="ml-12 mt-1 space-y-1">
                        {menu.children.map((child) => (
                          <NavLink
                            key={child.id}
                            to={child.path!}
                            onClick={closeSidebarAfterSelect}
                            className={({ isActive }) =>
                              `block rounded-xl px-3 py-2 text-sm font-medium transition-colors
                              ${isActive
                                ? 'bg-[#0D79BD] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                              }`
                            }
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ===== MENU NORMAL =====
              return (
                <NavLink
                  key={menu.id}
                  to={menu.path!}
                  end
                  title={!isSidebarExpanded ? menu.label : undefined}
                  onClick={closeSidebarAfterSelect}
                  className={({ isActive }) =>
                    `group flex items-center rounded-xl py-3 text-sm font-semibold transition-colors
                    ${isSidebarExpanded ? 'gap-3 px-4' : 'justify-center px-2'}
                    ${isActive
                      ? 'bg-[#0D79BD] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <span
                    className={`grid place-items-center rounded-lg p-2 transition-colors
                      ${
                      // keep icon readable in active state
                      location.pathname.includes(`/main/${menu.path}`)
                        ? 'bg-white/10'
                        : 'bg-gray-50 group-hover:bg-gray-100'
                      }`}
                  >
                    <Icon size={18} />
                  </span>
                  {isSidebarExpanded && <span className="truncate">{menu.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* ================= USER INFO ================= */}
          <div className="p-4 border-t border-gray-200">
            <div className={`flex items-center ${isSidebarExpanded ? 'gap-3' : 'justify-center'}`}>
              <div className="w-9 h-9 rounded-full bg-[#0D79BD] text-white flex items-center justify-center text-sm font-semibold">
                {userInitial}
              </div>
              {isSidebarExpanded && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize truncate">
                    {user.role}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ================= MAIN ================= */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {isMobile && (
                <button
                  type="button"
                  aria-label="Open sidebar"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="shrink-0 rounded-xl p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0D79BD]/30"
                >
                  <Menu size={20} />
                </button>
              )}
              <div className="min-w-0">
                <nav aria-label="Breadcrumb" className="flex items-center text-sm text-gray-500">
                  <ol className="flex items-center gap-2 min-w-0">
                    {breadcrumbs.map((bc, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <li key={`${bc.label}-${idx}`} className="flex items-center gap-2 min-w-0">
                          {idx === 0 ? (
                            <Home size={16} className="shrink-0 text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="shrink-0 text-gray-300" />
                          )}
                          {bc.to && !isLast ? (
                            <Link
                              to={bc.to}
                              className="truncate rounded-md px-2 py-1 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              {bc.label}
                            </Link>
                          ) : (
                            <span
                              className={
                                isLast
                                  ? 'truncate rounded-md px-2 py-1 text-gray-700 bg-gray-50 border border-gray-200'
                                  : 'truncate px-2 py-1'
                              }
                              aria-current={isLast ? 'page' : undefined}
                            >
                              {bc.label}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>

                <h1 className="mt-2 text-lg font-semibold text-gray-900 truncate">
                  {pageTitle}
                </h1>
              </div>

              <button
                onClick={handleLogout}
                className="group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                    bg-gray-50 border border-gray-200 hover:bg-red-100
                    transition-all"
              >
                <LogOut
                  size={18}
                  className="group-hover:rotate-12 transition-transform"
                />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default MainLayout;
