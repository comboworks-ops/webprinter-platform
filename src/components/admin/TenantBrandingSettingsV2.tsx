/** Compatibility URL: shop branding is edited in the single Site Design workspace. */
import { Navigate, useLocation } from 'react-router-dom';
export function TenantBrandingSettingsV2() {
  const { search } = useLocation();
  return <Navigate to={`/admin/site-design-v2${search}`} replace />;
}
export default TenantBrandingSettingsV2;
