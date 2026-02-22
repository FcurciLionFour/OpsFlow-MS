export type UserResponseDto = {
  id: string;
  organizationId: string;
  branchId: string | null;
  role: string;
  email: string;
  roles: string[];
};
