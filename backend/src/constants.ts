import type { Role } from "./types.js";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  viewer: ["users:read", "records:read", "summary:read"],
  analyst: [
    "users:read",
    "records:read",
    "records:create",
    "records:update",
    "summary:read"
  ],
  admin: [
    "users:read",
    "users:create",
    "users:update",
    "records:read",
    "records:create",
    "records:update",
    "records:delete",
    "summary:read"
  ]
};
