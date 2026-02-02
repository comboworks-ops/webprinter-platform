import { type ReactNode, type MouseEvent } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { usePreviewNavigation, useIsPreviewNavigation } from "@/contexts/PreviewNavigationContext";

interface PreviewLinkProps extends Omit<LinkProps, 'to'> {
    to: string;
    children: ReactNode;
}

/**
 * A Link component that works both in normal mode and preview mode.
 * In preview mode, it uses virtual navigation to keep the branding provider mounted.
 * In normal mode, it behaves like a regular React Router Link.
 */
export function PreviewLink({ to, children, className, onClick, ...props }: PreviewLinkProps) {
    const isVirtualNavigation = useIsPreviewNavigation();
    const { navigateTo } = usePreviewNavigation();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (isVirtualNavigation) {
            e.preventDefault();
            navigateTo(to);
        }
        // Call original onClick if provided
        onClick?.(e);
    };

    if (isVirtualNavigation) {
        // In preview mode, render an anchor that intercepts clicks
        return (
            <a
                href={to}
                className={className}
                onClick={handleClick}
                {...props}
            >
                {children}
            </a>
        );
    }

    // Normal mode: use React Router Link
    return (
        <Link to={to} className={className} onClick={onClick} {...props}>
            {children}
        </Link>
    );
}
