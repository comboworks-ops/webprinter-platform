import type {
  CompanyAddress,
  CompanyOffice,
  CreateCompanyAddressInput,
  CreateCompanyOfficeInput,
  UpdateCompanyAddressInput,
  UpdateCompanyOfficeInput,
} from "@/lib/company-hub";
import { CompanyLocationsView } from "./CompanyLocationsView";

interface AdminCompanyOfficesProps {
  offices: CompanyOffice[];
  addresses: CompanyAddress[];
  selectedOfficeId: string | null;
  isSaving: boolean;
  onSelectOffice: (officeId: string) => void;
  onCreateOffice: (input: CreateCompanyOfficeInput) => Promise<void>;
  onUpdateOffice: (officeId: string, input: UpdateCompanyOfficeInput) => Promise<void>;
  onArchiveOffice: (officeId: string) => Promise<void>;
  onCreateAddress: (input: CreateCompanyAddressInput) => Promise<void>;
  onUpdateAddress: (addressId: string, input: UpdateCompanyAddressInput) => Promise<void>;
  onArchiveAddress: (addressId: string) => Promise<void>;
}

export function AdminCompanyOffices(props: AdminCompanyOfficesProps) {
  return <CompanyLocationsView {...props} canManage />;
}
