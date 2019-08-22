export interface OrganizationDTO {
    id: string;
    description?: string;
    parentId?: string;
    active?: boolean;
    tz?: string;
    currency?: string;
    locale?: string;
  }