import { Button } from '@/components/ui/button';
import type { SelectorValueGroupConfig } from '@/lib/pricing/selectorValueGroups';

interface Props {
    groups: SelectorValueGroupConfig[];
    values: Array<{ id: string; name: string }>;
    onChange: (groups: SelectorValueGroupConfig[]) => void;
}

/** Presentation only: values retain their identities and source order. */
export function SelectorValueGroupsEditor({ groups, values, onChange }: Props) {
    const update = (index: number, patch: Partial<SelectorValueGroupConfig>) =>
        onChange(groups.map((group, position) => position === index ? { ...group, ...patch } : group));
    const assign = (index: number, valueId: string, checked: boolean) => onChange(groups.map((group, position) => ({
        ...group,
        valueIds: values.filter(value => position === index
            ? (value.id === valueId ? checked : group.valueIds.includes(value.id))
            : (!checked || value.id !== valueId) && group.valueIds.includes(value.id)).map(value => value.id),
    })));
    return <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Grupper af valg</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Saml fx særlige former i en foldbar gruppe. Valg uden en gruppe vises stadig.</p>
            {groups.map((group, index) => <fieldset className="min-w-0 space-y-3 rounded-md border p-3" key={group.id}>
                <legend className="px-1 text-xs font-medium">Gruppe {index + 1}</legend>
                <label className="block text-xs">Gruppens navn
                    <input className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base" value={group.label}
                        onChange={event => update(index, { label: event.target.value })} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs">
                    <input type="checkbox" checked={group.collapsible === true} onChange={event => update(index, { collapsible: event.target.checked })} />
                    Kan foldes sammen
                </label>
                {group.collapsible && <label className="flex min-h-11 items-center gap-2 text-xs">
                    <input type="checkbox" checked={group.initiallyExpanded === true} onChange={event => update(index, { initiallyExpanded: event.target.checked })} />
                    Åben fra start
                </label>}
                <label className="block text-xs">Visning i gruppen
                    <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base" value={group.uiMode || ''}
                        onChange={event => update(index, { uiMode: event.target.value || undefined })}>
                        <option value="">Brug sektionens visning</option>
                        <option value="buttons">Tekstknapper</option>
                        <option value="small">Små billeder</option>
                        <option value="medium">Mellemstore billeder</option>
                        <option value="large">Store billeder</option>
                        <option value="xl">Ekstra store billeder og tekst</option>
                        <option value="xl_notext">Ekstra store billeder</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="checkboxes">Afkrydsningsfelter</option>
                    </select>
                </label>
                <div className="max-h-64 overflow-auto rounded-md border p-2" role="group" aria-label={`Valg i ${group.label || `gruppe ${index + 1}`}`}>
                    {values.map(value => <label className="flex min-h-11 items-center gap-2 text-xs" key={value.id}>
                        <input type="checkbox" checked={group.valueIds.includes(value.id)} onChange={event => assign(index, value.id, event.target.checked)} />
                        <span className="min-w-0 break-words">{value.name}</span>
                    </label>)}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onChange(groups.filter((_, position) => position !== index))}>Fjern gruppe</Button>
            </fieldset>)}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([...groups, {
                id: crypto.randomUUID(), label: 'Ny gruppe', valueIds: [], collapsible: true, initiallyExpanded: false,
            }])}>Tilføj gruppe</Button>
        </div>
    </details>;
}
