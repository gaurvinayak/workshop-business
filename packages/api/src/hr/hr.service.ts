import { Injectable } from '@nestjs/common';
import {
  AppError,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateDepartmentInput,
  CreateDesignationInput,
  PaginationQuery,
  paginate,
  toSkipTake,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

const SENSITIVE_FIELDS = ['bankAccount', 'bankIfsc', 'taxId'] as const;

function toDate(v?: string | null): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return new Date(v);
}

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Departments & designations ----
  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }
  createDepartment(input: CreateDepartmentInput) {
    return this.prisma.department.create({ data: { name: input.name } });
  }
  listDesignations() {
    return this.prisma.designation.findMany({ orderBy: { name: 'asc' } });
  }
  createDesignation(input: CreateDesignationInput) {
    return this.prisma.designation.create({ data: { name: input.name } });
  }

  // ---- Employees ----
  async list(q: PaginationQuery, canViewSensitive: boolean) {
    const { skip, take } = toSkipTake(q);
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        skip,
        take,
        orderBy: { code: 'asc' },
        include: { department: true, designation: true },
      }),
      this.prisma.employee.count(),
    ]);
    return paginate(rows.map((e) => this.strip(e, canViewSensitive)), total, q);
  }

  async get(id: string, canViewSensitive: boolean) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true, designation: true },
    });
    if (!e) throw AppError.notFound('Employee');
    return this.strip(e, canViewSensitive);
  }

  async create(input: CreateEmployeeInput) {
    const existing = await this.prisma.employee.findUnique({ where: { code: input.code } });
    if (existing) throw AppError.conflict(`Employee code ${input.code} already exists`);
    return this.prisma.employee.create({
      data: {
        code: input.code,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        dateOfBirth: toDate(input.dateOfBirth) ?? null,
        dateJoined: new Date(input.dateJoined),
        departmentId: input.departmentId ?? null,
        designationId: input.designationId ?? null,
        bankAccount: input.bankAccount,
        bankIfsc: input.bankIfsc,
        taxId: input.taxId,
      },
    });
  }

  async update(id: string, input: UpdateEmployeeInput) {
    await this.get(id, true);
    return this.prisma.employee.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email === '' ? null : input.email,
        address: input.address,
        dateOfBirth: toDate(input.dateOfBirth),
        dateJoined: input.dateJoined ? new Date(input.dateJoined) : undefined,
        dateLeft: toDate(input.dateLeft),
        status: input.status,
        departmentId: input.departmentId,
        designationId: input.designationId,
        bankAccount: input.bankAccount,
        bankIfsc: input.bankIfsc,
        taxId: input.taxId,
      },
    });
  }

  /** Remove sensitive fields unless the caller is allowed to see them. */
  private strip<T extends Record<string, unknown>>(employee: T, canViewSensitive: boolean): T {
    if (canViewSensitive) return employee;
    const copy = { ...employee };
    for (const f of SENSITIVE_FIELDS) delete copy[f];
    return copy;
  }
}
