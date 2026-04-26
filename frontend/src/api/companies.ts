import api from "./axios";

export interface CompanyMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
}

export interface MyCompany {
  company_id: string;
  name: string;
  slug?: string;
}

export const companiesApi = {
  getMine: () => api.get<MyCompany>("/companies/mine"),
  listMembers: (companyId: string) =>
    api.get<CompanyMember[]>(`/companies/${companyId}/members`),
};
