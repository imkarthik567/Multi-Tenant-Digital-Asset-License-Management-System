import { prisma } from '../../config/database';
import { CreateCategoryInput, UpdateCategoryInput } from './category.schema';
import { ConflictError, NotFoundError } from '../../errors/AppError';

export class CategoryService {
  async listCategories(tenantId: string) {
    return prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        parentCategory: { select: { id: true, name: true } },
        subCategories: { select: { id: true, name: true } },
        _count: { select: { assets: { where: { deletedAt: null } } } },
      },
    });
  }

  async createCategory(tenantId: string, input: CreateCategoryInput, actorUserId?: string) {
    const existing = await prisma.category.findUnique({
      where: { uq_categories_tenant_name: { tenantId, name: input.name } },
    });
    if (existing) {
      throw new ConflictError(`Category "${input.name}" already exists in this tenant`);
    }

    if (input.parentCategoryId) {
      const parent = await prisma.category.findFirst({
        where: { id: input.parentCategoryId, tenantId },
      });
      if (!parent) throw new NotFoundError('Parent category not found in this tenant');
    }

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        parentCategoryId: input.parentCategoryId,
      },
      include: {
        parentCategory: { select: { id: true, name: true } },
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Category',
          entityId: category.id,
          action: 'CREATE',
          newValues: { name: category.name },
        },
      });
    }

    return category;
  }

  async updateCategory(tenantId: string, categoryId: string, input: UpdateCategoryInput, actorUserId?: string) {
    const existing = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!existing) throw new NotFoundError('Category not found');

    if (input.parentCategoryId) {
      if (input.parentCategoryId === categoryId) {
        throw new ConflictError('A category cannot be its own parent');
      }
      const parent = await prisma.category.findFirst({
        where: { id: input.parentCategoryId, tenantId },
      });
      if (!parent) throw new NotFoundError('Parent category not found in this tenant');
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: input,
      include: {
        parentCategory: { select: { id: true, name: true } },
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Category',
          entityId: categoryId,
          action: 'UPDATE',
          oldValues: { name: existing.name },
          newValues: input,
        },
      });
    }

    return updated;
  }

  async deleteCategory(tenantId: string, categoryId: string, actorUserId?: string) {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, tenantId },
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
    });

    if (!existing) throw new NotFoundError('Category not found');
    if (existing._count.assets > 0) {
      throw new ConflictError('Cannot delete category containing active assets');
    }

    await prisma.category.delete({ where: { id: categoryId } });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Category',
          entityId: categoryId,
          action: 'DELETE',
          oldValues: { name: existing.name },
        },
      });
    }
  }
}

export const categoryService = new CategoryService();
