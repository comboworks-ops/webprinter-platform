import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getActiveAdminWorkspaceGroup, getAdminWorkspaceGroups, withAdminWorkspaceContext } from '@/lib/admin/workspaceNavigation';

export function AdminWorkspaceNavigation({ isMasterContext, hasIconStudio }: { isMasterContext: boolean; hasIconStudio: boolean }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = getAdminWorkspaceGroups({ isMasterContext, hasIconStudio });
  const active = getActiveAdminWorkspaceGroup(location.pathname);
  return (
    <div className="admin-workspace-navigation">
      <button className="admin-workspace-mobile-toggle" type="button" aria-expanded={mobileOpen} aria-controls="admin-workspace-navigation" onClick={() => setMobileOpen(value => !value)}>
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        <span>{groups.find(group => group.id === active)?.label || 'Menu'}</span>
        <ChevronDown size={16} />
      </button>
      <nav id="admin-workspace-navigation" className="admin-workspace-nav" aria-label="Administration" data-mobile-open={mobileOpen}>
        {groups.map(group => (
          <DropdownMenu key={`${location.pathname}:${location.search}:${group.id}`}>
            <DropdownMenuTrigger className="admin-workspace-nav-item" data-active={active === group.id} aria-current={active === group.id ? 'true' : undefined}>
              {group.label}<ChevronDown size={14} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={0} className="admin-workspace-menu max-h-[min(70vh,600px)] min-w-60 overflow-y-auto">
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {group.links.map((link, index) => (
                <span key={link.path}>
                  {link.advanced && !group.links[index - 1]?.advanced && <><DropdownMenuSeparator /><DropdownMenuLabel>Avancerede værktøjer</DropdownMenuLabel></>}
                  <DropdownMenuItem asChild>
                    <Link to={withAdminWorkspaceContext(link.path, location.search)} aria-current={location.pathname === link.path ? 'page' : undefined} onClick={() => setMobileOpen(false)}>{link.label}</Link>
                  </DropdownMenuItem>
                </span>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </nav>
    </div>
  );
}
