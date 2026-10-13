// ==============================================================================
// AssetVault: Global Trigram Multi-Entity Search Engine
// Course: BCSE307L Database Systems (Fall 2026-27)
// Searches Assets, Licenses, Vendors and Tags in tenant using pg_trgm and ILIKE
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface SearchResultItem {
  id: string;
  type: 'asset' | 'license' | 'vendor' | 'tag';
  title: string;
  subtitle: string;
  url: string;
  status?: string;
  meta?: any;
}

export interface GlobalSearchResponse {
  query: string;
  results: {
    assets: SearchResultItem[];
    licenses: SearchResultItem[];
    vendors: SearchResultItem[];
    tags: SearchResultItem[];
  };
  total: number;
}

export class SearchService {
  public async searchAll(tenantId: string, q: string): Promise<GlobalSearchResponse> {
    const rawQuery = (q || '').trim();
    if (!rawQuery) {
      return {
        query: '',
        results: { assets: [], licenses: [], vendors: [], tags: [] },
        total: 0,
      };
    }

    const likePattern = `%${rawQuery}%`;

    try {
      // 1. Search Assets
      const assetRows: any = await prisma.$queryRaw(Prisma.sql`
        SELECT 
          id, asset_code, name, asset_type, status, description
        FROM assets
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND (name ILIKE ${likePattern} OR asset_code ILIKE ${likePattern} OR description ILIKE ${likePattern})
        ORDER BY 
          CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END,
          name ASC
        LIMIT 8;
      `);

      const assets: SearchResultItem[] = assetRows.map((a: any) => ({
        id: a.id,
        type: 'asset',
        title: a.name,
        subtitle: `${a.asset_code} • ${a.asset_type}`,
        url: `/assets/${a.id}`,
        status: a.status,
      }));

      // 2. Search Licenses
      const licenseRows: any = await prisma.$queryRaw(Prisma.sql`
        SELECT 
          l.id, l.name, l.license_key, l.status, l.total_seats, v.name AS vendor_name
        FROM licenses l
        JOIN vendors v ON v.id = l.vendor_id
        WHERE l.tenant_id = ${tenantId}::uuid
          AND l.deleted_at IS NULL
          AND (l.name ILIKE ${likePattern} OR l.license_key ILIKE ${likePattern} OR v.name ILIKE ${likePattern})
        ORDER BY 
          CASE WHEN l.name ILIKE ${likePattern} THEN 1 ELSE 2 END,
          l.name ASC
        LIMIT 8;
      `);

      const licenses: SearchResultItem[] = licenseRows.map((l: any) => ({
        id: l.id,
        type: 'license',
        title: l.name,
        subtitle: `${l.vendor_name} • ${l.total_seats} seats • ${l.license_key ? '***' + l.license_key.slice(-4) : ''}`,
        url: `/licenses/${l.id}`,
        status: l.status,
      }));

      // 3. Search Vendors
      const vendorRows: any = await prisma.$queryRaw(Prisma.sql`
        SELECT 
          id, name, contact_email
        FROM vendors
        WHERE tenant_id = ${tenantId}::uuid
          AND (name ILIKE ${likePattern} OR contact_email ILIKE ${likePattern})
        ORDER BY 
          CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END,
          name ASC
        LIMIT 8;
      `);

      const vendors: SearchResultItem[] = vendorRows.map((v: any) => ({
        id: v.id,
        type: 'vendor',
        title: v.name,
        subtitle: v.contact_email || 'Vendor Contact',
        url: `/vendors`,
      }));

      // 4. Search Tags
      const tagRows: any = await prisma.$queryRaw(Prisma.sql`
        SELECT 
          id, name, color
        FROM tags
        WHERE tenant_id = ${tenantId}::uuid
          AND name ILIKE ${likePattern}
        ORDER BY name ASC
        LIMIT 8;
      `);

      const tags: SearchResultItem[] = tagRows.map((t: any) => ({
        id: t.id,
        type: 'tag',
        title: `#${t.name}`,
        subtitle: `Tag Label`,
        url: `/assets?q=${encodeURIComponent(t.name)}`,
        meta: { color: t.color },
      }));

      const total = assets.length + licenses.length + vendors.length + tags.length;

      return {
        query: rawQuery,
        results: { assets, licenses, vendors, tags },
        total,
      };
    } catch (err: any) {
      logger.error({ err, q: rawQuery, tenantId }, 'Global search error');
      return {
        query: rawQuery,
        results: { assets: [], licenses: [], vendors: [], tags: [] },
        total: 0,
      };
    }
  }
}

export const searchService = new SearchService();
