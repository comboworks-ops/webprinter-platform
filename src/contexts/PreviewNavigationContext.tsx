import { createContext, useContext, useState, type ReactNode } from "react";

interface PreviewNavigationContextValue {
    /** Current virtual path in preview */
    currentPath: string;
    /** Navigate to a path (intercepted in preview mode) */
    navigateTo: (path: string) => void;
    /** Whether we're in preview mode with virtual navigation */
    isVirtualNavigation: boolean;
}

const PreviewNavigationContext = createContext<PreviewNavigationContextValue>({
    currentPath: '/',
    navigateTo: () => { },
    isVirtualNavigation: false,
});

interface PreviewNavigationProviderProps {
    children: ReactNode;
    initialPath?: string;
}

/**
 * Provides virtual navigation within the preview.
 * When in preview mode, navigation is intercepted and handled internally
 * to keep the branding provider mounted.
 */
export function PreviewNavigationProvider({
    children,
    initialPath = '/'
}: PreviewNavigationProviderProps) {
    const [currentPath, setCurrentPath] = useState(initialPath);

    const navigateTo = (path: string) => {
        // Normalize path
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        setCurrentPath(normalizedPath);
        // Scroll to top on navigation
        window.scrollTo(0, 0);
    };

    return (
        <PreviewNavigationContext.Provider value={{
            currentPath,
            navigateTo,
            isVirtualNavigation: true
        }}>
            {children}
        </PreviewNavigationContext.Provider>
    );
}

/**
 * Hook to access preview navigation.
 * Components can use this to navigate or check the current path.
 */
export function usePreviewNavigation() {
    return useContext(PreviewNavigationContext);
}

/**
 * Check if preview navigation is active.
 * Use this to determine if links should use virtual navigation.
 */
export function useIsPreviewNavigation() {
    const { isVirtualNavigation } = useContext(PreviewNavigationContext);
    return isVirtualNavigation;
}
