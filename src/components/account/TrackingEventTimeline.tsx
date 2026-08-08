import { AlertCircle, Clock, Loader2, MapPin, Truck } from 'lucide-react';

import type { TrackingTimeline } from '@/lib/delivery/trackingEvents';

type TrackingEventTimelineProps = {
    timeline?: TrackingTimeline | null;
    compact?: boolean;
};

export function TrackingEventTimeline({ timeline, compact = false }: TrackingEventTimelineProps) {
    const state = timeline?.state ?? 'loading';

    return (
        <section className="space-y-3" aria-live="polite">
            <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" aria-hidden="true" />
                <h4 className="font-medium">Transportørens hændelser</h4>
            </div>

            <p className="text-xs text-muted-foreground">
                PostNord-oplysninger vises som transportørbevis og ændrer ikke automatisk Webprinters ordrestatus.
            </p>

            {state === 'loading' && (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Henter transporthændelser…
                </div>
            )}

            {state === 'unavailable' && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>Transportørens oplysninger er midlertidigt utilgængelige. Webprinters ordrestatus er uændret.</p>
                </div>
            )}

            {state === 'empty' && (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Der er endnu ingen transporthændelser at vise.
                </p>
            )}

            {state === 'ready' && timeline && (
                <ol className="space-y-3">
                    {timeline.events.map((event, index) => (
                        <li key={`${event.source}:${event.id}`} className="flex gap-3">
                            <div className="flex flex-col items-center" aria-hidden="true">
                                <div className="mt-1 h-3 w-3 rounded-full bg-blue-500" />
                                {index < timeline.events.length - 1 && (
                                    <div className="min-h-8 w-0.5 flex-1 bg-muted" />
                                )}
                            </div>
                            <div className={`min-w-0 flex-1 ${compact ? 'pb-2' : 'pb-3'}`}>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <p className="text-sm font-medium">{event.label}</p>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                        {event.carrierLabel}
                                    </span>
                                </div>
                                {event.description && (
                                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                                )}
                                {event.location && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" aria-hidden="true" />
                                        {event.location}
                                    </p>
                                )}
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                    Hændelse: {formatTimelineInstant(event.occurredAt)}
                                </p>
                                {event.providerTimestamp && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Modtaget fra transportøren: {formatTimelineInstant(event.providerTimestamp)}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function formatTimelineInstant(value: string | null): string {
    if (!value) return 'tidspunkt ikke oplyst';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'tidspunkt ikke oplyst';
    return new Intl.DateTimeFormat('da-DK', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}
