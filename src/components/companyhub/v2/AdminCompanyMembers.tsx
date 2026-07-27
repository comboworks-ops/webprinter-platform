import { useState } from "react";
import { Loader2, MailPlus, Pencil, Plus, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AdminCompanyMember,
  InviteCompanyMemberInput,
  InviteCompanyMemberResult,
  SaveCompanyMemberInput,
} from "@/hooks/useAdminCompanyWorkspace";
import type { CompanyOffice, CompanyRole } from "@/lib/company-hub";

interface AdminCompanyMembersProps {
  members: AdminCompanyMember[];
  offices: CompanyOffice[];
  isSaving: boolean;
  onSave: (input: SaveCompanyMemberInput) => Promise<void>;
  onInvite: (input: InviteCompanyMemberInput) => Promise<InviteCompanyMemberResult>;
  onDisable: (userId: string) => Promise<void>;
}

const roleLabels: Record<CompanyRole, string> = {
  company_owner: "Ejer",
  company_admin: "Firmaadministrator",
  company_approver: "Godkender",
  company_buyer: "Indkøber",
  company_viewer: "Læsning",
};

const roleDescriptions: Record<CompanyRole, string> = {
  company_owner: "Fuld adgang til firma, medlemmer og ordrer",
  company_admin: "Administrerer firmaets opsætning",
  company_approver: "Kan godkende og afvise bestillinger",
  company_buyer: "Kan tilpasse og bestille produkter",
  company_viewer: "Kan se produkter uden at bestille",
};

interface MemberFormState {
  email: string;
  role: CompanyRole;
  isAllOffices: boolean;
  officeIds: string[];
}

const emptyMember: MemberFormState = {
  email: "",
  role: "company_buyer",
  isAllOffices: true,
  officeIds: [],
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Medlemmet kunne ikke gemmes.";
}

export function AdminCompanyMembers({
  members,
  offices,
  isSaving,
  onSave,
  onInvite,
  onDisable,
}: AdminCompanyMembersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyMember);
  const [disableTarget, setDisableTarget] = useState<AdminCompanyMember | null>(null);

  const activeMembers = members.filter((member) => member.status !== "disabled");

  const openNew = () => {
    setEditingUserId(null);
    setForm(emptyMember);
    setDialogOpen(true);
  };

  const openEdit = (member: AdminCompanyMember) => {
    setEditingUserId(member.user_id);
    setForm({
      email: member.user_email || "",
      role: member.role as CompanyRole,
      isAllOffices: member.is_all_offices !== false,
      officeIds: member.office_ids,
    });
    setDialogOpen(true);
  };

  const toggleOffice = (officeId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      officeIds: checked
        ? [...new Set([...current.officeIds, officeId])]
        : current.officeIds.filter((id) => id !== officeId),
    }));
  };

  const save = async () => {
    if (!editingUserId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Indtast en gyldig e-mailadresse.");
      return;
    }
    try {
      if (editingUserId) {
        await onSave({
          userId: editingUserId,
          role: form.role,
          isAllOffices: form.isAllOffices,
          officeIds: form.officeIds,
        });
        toast.success("Adgangen er opdateret");
      } else {
        const result = await onInvite({
          email: form.email,
          role: form.role,
          isAllOffices: form.isAllOffices,
          officeIds: form.officeIds,
        });
        toast.success(
          result.invitationSent
            ? `Invitationen er sendt til ${result.email}`
            : `${result.email} har nu adgang med sin eksisterende konto`,
        );
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const disable = async () => {
    if (!disableTarget) return;
    try {
      await onDisable(disableTarget.user_id);
      toast.success("Medlemmet er deaktiveret");
      setDisableTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="company-members-heading" className="py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Adgang</p>
          <h2 id="company-members-heading" className="text-lg font-semibold">Medlemmer og roller</h2>
          <p className="mt-1 text-sm text-muted-foreground">Giv kun adgang til de kontorer og handlinger, brugeren behøver.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tilføj medlem
        </Button>
      </div>

      <div className="mt-5 divide-y border-y bg-background">
        {activeMembers.map((member) => (
          <div key={member.user_id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.user_name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.user_email || "E-mail mangler"}</p>
              </div>
            </div>
            <div className="sm:w-52">
              <p className="text-sm font-medium">{roleLabels[member.role as CompanyRole]}</p>
              <p className="text-xs text-muted-foreground">{roleDescriptions[member.role as CompanyRole]}</p>
            </div>
            <div className="sm:w-44">
              <p className="text-xs font-medium text-muted-foreground">Kontoradgang</p>
              <p className="mt-0.5 text-sm">
                {member.is_all_offices
                  ? "Alle kontorer"
                  : `${member.office_ids.length} valgt${member.office_ids.length === 1 ? "" : "e"}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(member)} title="Rediger adgang">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Rediger {member.user_name}</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setDisableTarget(member)} title="Deaktiver adgang">
                <UserRoundX className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Deaktiver {member.user_name}</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!activeMembers.length && (
        <div className="flex min-h-40 flex-col items-center justify-center border-b text-center">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium">Ingen medlemmer endnu</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUserId ? "Rediger adgang" : "Tilføj medlem"}</DialogTitle>
            <DialogDescription>
              {editingUserId
                ? "Tilpas rolle og kontoradgang for medlemmet."
                : "Invitér en kollega direkte med e-mail. Personen behøver ikke allerede være bruger på platformen."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="company-member-email">E-mail</Label>
              <Input
                id="company-member-email"
                type="email"
                autoComplete="email"
                value={form.email}
                placeholder="navn@firma.dk"
                disabled={Boolean(editingUserId)}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
              {!editingUserId && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MailPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Nye brugere får en invitation til at oprette adgang. Eksisterende brugere får adgang med deres nuværende konto.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as CompanyRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as CompanyRole[]).map((role) => (
                    <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{roleDescriptions[form.role]}</p>
            </div>
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.isAllOffices}
                onCheckedChange={(checked) => setForm({ ...form, isAllOffices: checked === true })}
              />
              <span>
                <span className="block font-medium">Adgang til alle kontorer</span>
                <span className="block text-xs text-muted-foreground">Nye kontorer bliver automatisk tilgængelige.</span>
              </span>
            </label>
            {!form.isAllOffices && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Udvalgte kontorer</legend>
                {offices.map((office) => (
                  <label key={office.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.officeIds.includes(office.id)}
                      onCheckedChange={(checked) => toggleOffice(office.id, checked === true)}
                    />
                    {office.name}
                  </label>
                ))}
                {!offices.length && <p className="text-xs text-muted-foreground">Opret et kontor først.</p>}
              </fieldset>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={save} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {editingUserId ? "Gem adgang" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(disableTarget)} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deaktiver {disableTarget?.user_name}?</AlertDialogTitle>
            <AlertDialogDescription>Brugeren mister adgang, men historiske aktiviteter og ordrer bevares.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={disable}>Deaktiver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
