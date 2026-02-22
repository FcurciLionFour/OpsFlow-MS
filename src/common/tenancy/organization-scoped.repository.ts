export interface OrganizationScopedRepository<
  TEntity,
  TListFilters,
  TCreateInput,
> {
  findById(organizationId: string, id: string): Promise<TEntity | null>;
  list(organizationId: string, filters: TListFilters): Promise<TEntity[]>;
  create(organizationId: string, data: TCreateInput): Promise<TEntity>;
}
