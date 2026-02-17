export const TASK_SCOPES = ['company', 'restaurant'] as const;

export type TaskScope = (typeof TASK_SCOPES)[number];

export type RestaurantTaskScope = {
  scope: 'restaurant';
  restaurant_id: string;
  company_id?: string | null;
};

export type CompanyTaskScope = {
  scope: 'company';
  company_id: string;
  restaurant_id: string | null;
};

export type ScopedTaskTarget = RestaurantTaskScope | CompanyTaskScope;
