export function PrintWarningAcknowledgement({ issues, accepted, onChange, label }: {
  issues: string[];
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  label: string;
}) {
  if (!issues.length) return null;
  return <div className="space-y-2 text-sm text-amber-900">
    <p className="font-medium">Bemærkninger til filen</p>
    <ul className="list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    <label className="flex min-h-11 items-start gap-2 py-2">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={accepted} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  </div>;
}
