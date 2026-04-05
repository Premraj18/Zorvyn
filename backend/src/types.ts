export type Role = "viewer" | "analyst" | "admin";

export type RecordType = "income" | "expense";

export interface RequestUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: number;
}
