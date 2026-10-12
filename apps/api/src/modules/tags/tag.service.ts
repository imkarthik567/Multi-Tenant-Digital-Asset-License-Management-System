import { prisma } from '../../config/database';
import { CreateTagInput, UpdateTagInput } from './tag.schema';
import { ConflictError, NotFoundError } from '../../errors/AppError';

export class TagService {
  async listTags(tenantId: string) {
    return prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assetTags: true } },
      },
    });
  }

  async createTag(tenantId: string, input: CreateTagInput, actorUserId?: string) {
    const existing = await prisma.tag.findUnique({
      where: { uq_tags_tenant_name: { tenantId, name: input.name } },
    });
    if (existing) {
      throw new ConflictError(`Tag "${input.name}" already exists in this tenant`);
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: input.name,
        colorHex: input.colorHex,
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Tag',
          entityId: tag.id,
          action: 'CREATE',
          newValues: { name: tag.name },
        },
      });
    }

    return tag;
  }

  async updateTag(tenantId: string, tagId: string, input: UpdateTagInput, actorUserId?: string) {
    const existing = await prisma.tag.findFirst({ where: { id: tagId, tenantId } });
    if (!existing) throw new NotFoundError('Tag not found');

    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: input,
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Tag',
          entityId: tagId,
          action: 'UPDATE',
          oldValues: { name: existing.name },
          newValues: input,
        },
      });
    }

    return updated;
  }

  async deleteTag(tenantId: string, tagId: string, actorUserId?: string) {
    const existing = await prisma.tag.findFirst({ where: { id: tagId, tenantId } });
    if (!existing) throw new NotFoundError('Tag not found');

    await prisma.tag.delete({ where: { id: tagId } });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Tag',
          entityId: tagId,
          action: 'DELETE',
          oldValues: { name: existing.name },
        },
      });
    }
  }
}

export const tagService = new TagService();
