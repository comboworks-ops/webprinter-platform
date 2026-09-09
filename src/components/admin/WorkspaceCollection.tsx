import { Children, useId, useState, type ReactNode } from "react";
import { ChevronRight, ImageIcon } from "lucide-react";

export interface WorkspaceCollectionItem {
  id: string;
  title: string;
  subtitle?: string | null;
  image?: string | null;
  icon?: ReactNode;
  group?: string;
}

/** A local selection changes presentation only. Existing item actions stay in their original components. */
export function WorkspaceCollection({ items, children, label = "Vælg element", className = "" }: {
  items: WorkspaceCollectionItem[];
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const regionId = useId();
  const panels = Children.toArray(children);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selectedId));

  if (!items.length) return <>{children}</>;

  return (
    <div className={`workspace-collection ${className}`}>
      <nav className="workspace-collection-list" aria-label={label}>
        {items.map((item, index) => (
          <div key={item.id}>
            {item.group && item.group !== items[index - 1]?.group && (
              <h3 className="workspace-collection-group">{item.group}</h3>
            )}
            <button
              type="button"
              className="workspace-collection-option"
              aria-current={selectedIndex === index ? "true" : undefined}
              aria-controls={`${regionId}-${index}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="workspace-collection-thumbnail">
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : item.icon || <ImageIcon aria-hidden="true" />}
              </span>
              <span className="workspace-collection-label">
                <strong>{item.title}</strong>
                {item.subtitle && <span>{item.subtitle}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        ))}
      </nav>
      <div className="workspace-collection-detail">
        {panels.map((panel, index) => (
          <section key={items[index]?.id || index} id={`${regionId}-${index}`} hidden={index !== selectedIndex} aria-label={items[index]?.title}>
            {panel}
          </section>
        ))}
      </div>
    </div>
  );
}
