import { useLocation } from 'react-router-dom';
import { withAdminWorkspaceContext } from '@/lib/admin/workspaceNavigation';

const statusLabels: Record<string, string> = {
  pending: 'Afventer', processing: 'Behandles', production: 'Under produktion',
  shipped: 'Afsendt', delivered: 'Leveret', cancelled: 'Annulleret', problem: 'Problem',
};

export function OrderStatus({ status }: { status: string }) {
  return <span className="ow-status" data-status={status}><span aria-hidden="true" />{statusLabels[status] || status || 'Ukendt status'}</span>;
}

export const orderCurrency = (value: number) => new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(Number(value) || 0);
export const orderDate = (value: string, includeTime = false) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Ikke angivet';
  return new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', day: '2-digit', month: '2-digit', year: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(date);
};

export function WorkspaceDate() {
  return <time className="ow-date" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</time>;
}

/** Keep the selected storefront when moving between admin workspaces. */
export function useOrderWorkspaceLink() {
  const { search } = useLocation();
  return (path: string) => withAdminWorkspaceContext(path, search);
}
