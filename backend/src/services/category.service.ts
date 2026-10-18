// ==============================================================================
// AssetVault: Category Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces taxonomy cycle prevention and blocks deletion on non-empty categories
// ==============================================================================

import { categoryRepository } from '../repositories/category.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export interface CategoryTreeNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  assetCount: number;
  children: CategoryTreeNode[];
}

export class CategoryService {
  public async listCategories(prismaClient: any, params: PaginationParams, filter?: { parentId?: string | null }) {
    const { data, total } = await categoryRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getCategoryById(prismaClient: any, id: string) {
    const category = await categoryRepository.findById(prismaClient, id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  /**
   * Builds full hierarchical nested tree of categories for the tenant
   */
  public async getCategoryTree(prismaClient: any): Promise<CategoryTreeNode[]> {
    const all = await categoryRepository.findAllForTree(prismaClient);

    const map = new Map<string, CategoryTreeNode>();
    all.forEach((cat: any) => {
      map.set(cat.id, {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentId: cat.parentId,
        assetCount: cat._count?.assets || 0,
        children: [],
      });
    });

    const rootNodes: CategoryTreeNode[] = [];
    all.forEach((cat: any) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  public async createCategory(prismaClient: any, tenantId: string, data: any) {
    // Serialize hierarchy changes per tenant so a concurrent reparent cannot
    // invalidate the cycle check between its read and write.
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', '', true),
          set_config('app.is_super_admin', 'false', true);`
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0));`
      );

      if (data.parentId) {
        const parent = await categoryRepository.findById(tx, data.parentId);
        if (!parent) {
          throw new BadRequestError('Parent category not found.');
        }
      }

      return categoryRepository.create(tx, {
        name: data.name,
        description: data.description || null,
        tenant: { connect: { id: tenantId } },
        parent: data.parentId ? { connect: { id: data.parentId } } : undefined,
      });
    });
  }

  public async updateCategory(prismaClient: any, id: string, data: any) {
    // Description/name-only updates do not change the tree and need no lock.
    if (data.parentId === undefined) {
      await this.getCategoryById(prismaClient, id);
      return categoryRepository.update(prismaClient, id, {
        name: data.name,
        description: data.description,
      });
    }

    const existing = await this.getCategoryById(prismaClient, id);
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', ${existing.tenantId}, true),
          set_config('app.current_user_id', '', true),
          set_config('app.is_super_admin', 'false', true);`
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${existing.tenantId}, 0));`
      );

      // Re-read after taking the lock so validation uses the latest tree.
      const category = await categoryRepository.findById(tx, id);
      if (!category) {
        throw new NotFoundError('Category not found');
      }

      if (data.parentId === id) {
        throw new ConflictError('A category cannot be its own parent.');
      }

      if (data.parentId !== null) {
        let currentParentId: string | null = data.parentId;
        const visited = new Set<string>();

        while (currentParentId) {
          if (currentParentId === id) {
            throw new ConflictError('Cyclic category dependency detected: a category cannot become its own descendant.');
          }
          if (visited.has(currentParentId)) {
            break;
          }
          visited.add(currentParentId);

          const ancestor = await categoryRepository.findById(tx, currentParentId);
          currentParentId = ancestor?.parentId || null;
        }
      }

      return categoryRepository.update(tx, id, {
        name: data.name,
        description: data.description,
        parent:
          data.parentId === null
            ? { disconnect: true }
            : data.parentId
            ? { connect: { id: data.parentId } }
            : undefined,
      });
    });
  }

  public async deleteCategory(prismaClient: any, id: string) {
    const category = await this.getCategoryById(prismaClient, id);

    // Block deletion if it has children or assets (Course requirement: return 409)
    if (category.children && category.children.length > 0) {
      throw new ConflictError('Cannot delete category with child subcategories. Please reassign or delete subcategories first.');
    }

    if (category._count?.assets > 0) {
      throw new ConflictError('Cannot delete category with associated digital assets. Please reassign assets first.');
    }

    return categoryRepository.delete(prismaClient, id);
  }
}

export const categoryService = new CategoryService();
