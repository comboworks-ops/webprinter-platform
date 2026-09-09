/** Editors can cancel new shell exits while keeping their existing save dialogs. */
export const ADMIN_WORKSPACE_EXIT_EVENT = 'admin-workspace:before-leave';

export function requestAdminWorkspaceExit(): boolean {
  return window.dispatchEvent(new Event(ADMIN_WORKSPACE_EXIT_EVENT, { cancelable: true }));
}
