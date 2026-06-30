import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(data: T[], total: number, q: PaginationQuery): Paginated<T> {
  return { data, total, page: q.page, pageSize: q.pageSize };
}

/** Convert page/pageSize into Prisma skip/take. */
export function toSkipTake(q: PaginationQuery): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
