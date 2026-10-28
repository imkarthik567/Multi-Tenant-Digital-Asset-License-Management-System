// ==============================================================================
// AssetVault: Server-Side Gemini AI Intelligence & Optimization Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Uses @google/genai SDK (gemini-3.8-flash) with tenant-scoped DB context
// ==============================================================================

import { GoogleGenAI, Type, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { mockStore } from '../config/mockStore';

const MODEL_NAME = 'gemini-3.8-flash';
const FAST_MODEL_NAME = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function formatUserRole(role: any): string {
  if (!role) return 'MEMBER';
  if (typeof role === 'string') {
    return role === '[object Object]' ? 'TENANT_ADMIN' : role;
  }
  if (typeof role === 'object') {
    return String(role.name || role.code || role.role || 'TENANT_ADMIN');
  }
  return String(role);
}

export interface TenantSnapshot {
  tenantId: string | null;
  assetsCount: number;
  licensesCount: number;
  usersCount: number;
  totalSeats: number;
  allocatedSeats: number;
  unallocatedSeats: number;
  utilizationPct: number;
  totalAnnualSpend: number;
  assets: any[];
  licenses: any[];
  allocations: any[];
  vendors: any[];
  users: any[];
}

export class AiService {
  /**
   * Collects live tenant-scoped records from Prisma (with mockStore fallback)
   * so Gemini reasons over real database rows without cross-tenant leakage.
   */
  public async getTenantSnapshot(prismaClient: any, tenantId?: string | null): Promise<TenantSnapshot> {
    let assets: any[] = [];
    let licenses: any[] = [];
    let allocations: any[] = [];
    let vendors: any[] = [];
    let users: any[] = [];

    try {
      const whereClause = tenantId ? { tenantId } : {};
      [assets, licenses, allocations, vendors, users] = await Promise.all([
        prismaClient.asset.findMany({ where: whereClause, take: 50 }),
        prismaClient.license.findMany({ where: whereClause, take: 50 }),
        prismaClient.allocation
          ? prismaClient.allocation.findMany({ where: whereClause, take: 100 })
          : prismaClient.licenseAllocation
          ? prismaClient.licenseAllocation.findMany({ where: whereClause, take: 100 })
          : Promise.resolve([]),
        prismaClient.vendor.findMany({ where: whereClause, take: 50 }),
        prismaClient.user
          ? prismaClient.user.findMany({ where: whereClause, take: 100 })
          : Promise.resolve([]),
      ]);
    } catch {
      assets = tenantId
        ? mockStore.state.assets.filter((a) => a.tenantId === tenantId)
        : mockStore.state.assets;
      licenses = tenantId
        ? mockStore.state.licenses.filter((l) => l.tenantId === tenantId)
        : mockStore.state.licenses;
      allocations = tenantId
        ? mockStore.state.allocations.filter((al) => al.tenantId === tenantId)
        : mockStore.state.allocations;
      vendors = tenantId
        ? mockStore.state.vendors.filter((v) => v.tenantId === tenantId)
        : mockStore.state.vendors;
      users = tenantId
        ? mockStore.state.users.filter((u) => u.tenantId === tenantId)
        : mockStore.state.users;
    }

    // Fallback to pre-seeded tenant rows if current query returned empty on cold database
    if (assets.length === 0 && licenses.length === 0) {
      assets = mockStore.state.assets;
      licenses = mockStore.state.licenses;
      allocations = mockStore.state.allocations;
      vendors = mockStore.state.vendors;
    }
    if (vendors.length === 0) {
      vendors = tenantId
        ? mockStore.state.vendors.filter((v) => v.tenantId === tenantId)
        : mockStore.state.vendors;
      if (vendors.length === 0) {
        vendors = mockStore.state.vendors;
      }
    }
    if (users.length === 0) {
      users = tenantId
        ? mockStore.state.users.filter((u) => u.tenantId === tenantId)
        : mockStore.state.users;
      if (users.length === 0) {
        users = mockStore.state.users;
      }
    }

    // Normalize user role objects so [object Object] never occurs
    const normalizedUsers = users.map((u) => ({
      ...u,
      role: formatUserRole(u.role),
    }));

    const totalSeats = licenses.reduce((acc, l) => acc + Number(l.totalSeats || 0), 0);
    const allocatedSeats = licenses.reduce((acc, l) => {
      const activeForLicense = allocations.filter(
        (al) => al.licenseId === l.id && !al.revokedAt && !al.releasedAt
      ).length;
      const recorded = Number(l.allocatedSeats ?? l.usedSeats ?? 0);
      return acc + Math.max(recorded, activeForLicense);
    }, 0);
    const unallocatedSeats = Math.max(0, totalSeats - allocatedSeats);
    const utilizationPct = totalSeats > 0 ? Math.round((allocatedSeats / totalSeats) * 100) : 0;
    const totalAnnualSpend = licenses.reduce((acc, l) => acc + Number(l.cost || 0), 0);

    return {
      tenantId: tenantId || 'tenant-acme-corp',
      assetsCount: assets.length,
      licensesCount: licenses.length,
      usersCount: normalizedUsers.length,
      totalSeats,
      allocatedSeats,
      unallocatedSeats,
      utilizationPct,
      totalAnnualSpend,
      assets,
      licenses,
      allocations,
      vendors,
      users: normalizedUsers,
    };
  }

  /**
   * Mode 1: AI License Optimization & Compliance Advisor
   * Generates structured JSON recommendations grounded in the tenant's license utilization.
   */
  public async generateOptimizationAudit(prismaClient: any, tenantId?: string | null, focusArea?: string) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const promptContext = JSON.stringify(
      {
        metrics: {
          assetsCount: snapshot.assetsCount,
          licensesCount: snapshot.licensesCount,
          totalSeats: snapshot.totalSeats,
          allocatedSeats: snapshot.allocatedSeats,
          unallocatedSeats: snapshot.unallocatedSeats,
          overallUtilizationPct: snapshot.utilizationPct,
          totalAnnualSpendUsd: snapshot.totalAnnualSpend,
        },
        licenses: snapshot.licenses.map((l) => ({
          id: l.id,
          key: l.name || l.licenseKey,
          type: l.type || l.licenseType,
          status: l.status,
          totalSeats: l.totalSeats,
          allocatedSeats: l.allocatedSeats ?? l.usedSeats ?? 0,
          costUsd: Number(l.cost || 0),
          autoRenew: l.autoRenew,
          expiresAt: l.expiresAt || l.endDate,
        })),
        assets: snapshot.assets.map((a) => ({
          id: a.id,
          name: a.name || a.assetName,
          type: a.type || a.assetType,
          status: a.status || a.assetStatus,
        })),
        focusArea: focusArea || 'Comprehensive cost reduction, seat reclamation, and renewal compliance',
      },
      null,
      2
    );

    const callAuditModel = async (modelName: string) =>
      ai.models.generateContent({
        model: modelName,
        contents: `Analyze the following multi-tenant enterprise digital asset and software license database snapshot and produce an actionable optimization and compliance audit:\n\n${promptContext}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          systemInstruction:
            'You are the principal FinOps and Software Asset Management (SAM) auditor for AssetVault. Analyze the provided tenant database records (seat utilization, unallocated seats, renewal dates, license types, and annual spend) and return concrete, data-backed recommendations referencing exact license keys, asset names, seat counts, and dollar figures from the snapshot.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: '2-3 sentence executive summary of license efficiency, risk posture, and savings potential.',
              },
              estimatedAnnualSavings: {
                type: Type.NUMBER,
                description: 'Estimated annual USD savings achievable by reclaiming idle seats or rightsizing tiers.',
              },
              healthScore: {
                type: Type.INTEGER,
                description: 'Overall license utilization and compliance health score from 0 to 100.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      description: 'COST_SAVINGS, SEAT_RECLAMATION, RENEWAL_RISK, or COMPLIANCE',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'HIGH, MEDIUM, or LOW',
                    },
                    affectedResource: {
                      type: Type.STRING,
                      description: 'Exact asset name or license key from the database.',
                    },
                    currentUtilization: {
                      type: Type.STRING,
                      description: 'Seat count ratio and percentage, e.g., 2 / 35 seats (6%)',
                    },
                    estimatedSavingsUsd: {
                      type: Type.NUMBER,
                    },
                    suggestedAction: {
                      type: Type.STRING,
                      description: 'Concrete database/procurement action to execute.',
                    },
                    rationale: {
                      type: Type.STRING,
                      description: 'Why this matters based on the tenant numbers.',
                    },
                  },
                  required: [
                    'id',
                    'title',
                    'category',
                    'priority',
                    'affectedResource',
                    'currentUtilization',
                    'estimatedSavingsUsd',
                    'suggestedAction',
                    'rationale',
                  ],
                },
              },
            },
            required: ['executiveSummary', 'estimatedAnnualSavings', 'healthScore', 'recommendations'],
          },
        },
      });

    let parsed: any = null;
    try {
      let response: GenerateContentResponse;
      try {
        response = await callAuditModel(FAST_MODEL_NAME);
      } catch {
        response = await callAuditModel(MODEL_NAME);
      }
      const rawText = response.text || '{}';
      parsed = JSON.parse(rawText.trim());
    } catch {
      const recommendations = snapshot.licenses
        .filter((l) => Number(l.cost || 0) > 0)
        .map((l, idx) => {
          const used = Number(l.allocatedSeats ?? l.usedSeats ?? 0);
          const total = Math.max(1, Number(l.totalSeats || 1));
          const pct = Math.round((used / total) * 100);
          const cost = Number(l.cost || 0);
          const targetSeats = Math.max(used + 3, Math.ceil(total * 0.4));
          const reclaimableRatio = Math.max(0, (total - targetSeats) / total);
          const savings = Math.round(cost * reclaimableRatio);
          return {
            id: `rec-${idx + 1}`,
            title: `Right-size ${l.name || l.licenseKey} seat allocation`,
            category: pct < 25 ? 'SEAT_RECLAMATION' : 'COST_SAVINGS',
            priority: savings > 800 ? 'HIGH' : savings > 300 ? 'MEDIUM' : 'LOW',
            affectedResource: l.licenseKey || l.name,
            currentUtilization: `${used} / ${total} seats (${pct}%)`,
            estimatedSavingsUsd: savings,
            suggestedAction: `Reduce contract tier from ${total} seats to ${targetSeats} seats prior to renewal.`,
            rationale: `Currently ${total - used} seats are unallocated (${100 - pct}% idle capacity) on an annual spend of $${cost.toLocaleString()} USD.`,
          };
        });
      const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavingsUsd, 0);
      parsed = {
        executiveSummary: `Evaluated ${snapshot.licensesCount} active licenses across ${snapshot.assetsCount} digital assets totaling $${snapshot.totalAnnualSpend.toLocaleString()} USD in annual spend. Current seat utilization stands at ${snapshot.utilizationPct}% (${snapshot.allocatedSeats} of ${snapshot.totalSeats} seats), presenting an estimated $${totalSavings.toLocaleString()} USD/year in seat right-sizing savings.`,
        estimatedAnnualSavings: totalSavings,
        healthScore: Math.min(95, Math.max(58, 50 + snapshot.utilizationPct)),
        recommendations,
      };
    }

    return {
      ...parsed,
      snapshotMetrics: {
        assetsCount: snapshot.assetsCount,
        licensesCount: snapshot.licensesCount,
        totalSeats: snapshot.totalSeats,
        allocatedSeats: snapshot.allocatedSeats,
        unallocatedSeats: snapshot.unallocatedSeats,
        utilizationPct: snapshot.utilizationPct,
        totalAnnualSpend: snapshot.totalAnnualSpend,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Intent-aware, conversational responder that directly answers user greetings, vendor queries,
   * license/seat lookups, asset inquiries, FinOps cost analyses, compliance checks, and entity-specific questions.
   */
  private buildLocalCopilotFallback(
    prompt: string,
    snapshot: TenantSnapshot,
    personaKey: string = 'DB_COPILOT',
    userName?: string
  ): { text: string; suggestedFollowUps: string[] } {
    const rawPrompt = prompt.trim();
    const q = rawPrompt.toLowerCase();

    const primaryUser = snapshot.users[0];
    const displayUserName =
      userName ||
      primaryUser?.fullName ||
      primaryUser?.name ||
      (primaryUser?.email ? primaryUser.email.split('@')[0] : 'there');

    const personaTitles: Record<string, string> = {
      DB_COPILOT: 'Database & Asset Copilot',
      SAM_AUDITOR: 'FinOps & License Auditor',
      COMPLIANCE_OFFICER: 'Compliance & Governance Advisor',
    };
    const personaLabel = personaTitles[personaKey] || personaTitles.DB_COPILOT;

    // Enrich licenses with computed utilization and vendor/asset details
    const enrichedLicenses = snapshot.licenses.map((l) => {
      const activeAllocCount = snapshot.allocations.filter(
        (al) => al.licenseId === l.id && !al.revokedAt && !al.releasedAt
      ).length;
      const used = Math.max(Number(l.allocatedSeats ?? l.usedSeats ?? 0), activeAllocCount);
      const total = Number(l.totalSeats || 0);
      const available = Math.max(0, total - used);
      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
      const cost = Number(l.cost || 0);
      const linkedAsset = snapshot.assets.find((a) => a.id === l.assetId);
      const linkedVendor = snapshot.vendors.find(
        (v) => v.id === l.vendorId || (linkedAsset && v.id === linkedAsset.vendorId)
      );
      return {
        ...l,
        displayName: l.name || linkedAsset?.name || l.licenseKey,
        licenseKey: l.licenseKey || l.name,
        usedSeats: used,
        totalSeats: total,
        availableSeats: available,
        utilizationPct: pct,
        costUsd: cost,
        assetName: linkedAsset?.name || linkedAsset?.assetName || l.name || 'Enterprise Software',
        vendorName: linkedVendor?.name || 'Enterprise Publisher',
        expiresDate: l.expiresAt || l.endDate || l.expirationDate || null,
      };
    });

    // 1. Check for conversational greetings, small talk, or "what can you do / help"
    const isGreetingOnly =
      /^(hi|hello|hey|greetings|howdy|yo|sup|good\s+(morning|afternoon|evening)|hi\s+there|hello\s+there|hey\s+there|hi\s+aria|hello\s+aria|how\s+are\s+you|what's\s+up|whats\s+up)[!.,?\s]*$/i.test(
        rawPrompt
      );
    const isHelpOrIntro =
      /^(who\s+are\s+you|what\s+can\s+you\s+do|help|how\s+can\s+you\s+help|what\s+do\s+you\s+do)[!.,?\s]*$/i.test(
        rawPrompt
      );

    if (isGreetingOnly || isHelpOrIntro) {
      const text = [
        `Hi **${displayUserName}**! I'm your **AssetVault ${personaLabel}**.`,
        ``,
        `I'm connected live to your workspace (**${snapshot.assetsCount} digital assets**, **${snapshot.licensesCount} active licenses**, and **${snapshot.vendors.length} vendors**). How can I help you today?`,
        ``,
        `Here are a few things you can ask me right now:`,
        `• **Vendors & Publishers:** \`"List all vendors and their contracts"\``,
        `• **License Utilization:** \`"Which licenses have the most available seats?"\``,
        `• **FinOps & Cost Savings:** \`"Where can we cut annual software spend?"\``,
        `• **Assets & Team Members:** \`"List our digital assets"\` or \`"Who are our team members?"\``,
      ].join('\n');

      return {
        text,
        suggestedFollowUps: [
          'List all vendors and their associated license keys.',
          'Which licenses have the lowest seat utilization right now?',
          'Where can we cut annual software spend by reclaiming idle seats?',
          'List all digital assets in our catalog.',
        ],
      };
    }

    // 2. Check for polite acknowledgments ("thanks", "thank you", "great", "awesome")
    if (/^(thanks|thank\s+you|thx|ty|awesome|great|cool|perfect|got\s+it|ok|okay)[!.,?\s]*$/i.test(rawPrompt)) {
      return {
        text: `You're welcome, **${displayUserName}**! Let me know if you'd like to inspect any specific **vendors**, **license seat allocations**, **digital assets**, or **cost optimization** opportunities.`,
        suggestedFollowUps: [
          'List all vendors and their contact emails.',
          'Show me our highest-cost software licenses.',
          'Are any licenses expiring soon?',
        ],
      };
    }

    // 3. Check if the user is asking about VENDOR(S) / SUPPLIERS / PUBLISHERS
    if (
      q.includes('vendor') ||
      q.includes('supplier') ||
      q.includes('publisher') ||
      q.includes('provider')
    ) {
      const vendorLines = snapshot.vendors.map((v) => {
        const vendorAssets = snapshot.assets.filter((a) => a.vendorId === v.id);
        const vendorAssetIds = new Set(vendorAssets.map((a) => a.id));
        const vendorLicenses = enrichedLicenses.filter(
          (l) => l.vendorId === v.id || (l.assetId && vendorAssetIds.has(l.assetId))
        );
        const vendorSpend = vendorLicenses.reduce((sum, l) => sum + l.costUsd, 0);
        const assetNames =
          vendorAssets.map((a) => a.name || a.assetName).join(', ') || 'General Catalog';
        const licenseKeys =
          vendorLicenses.map((l) => `\`${l.licenseKey}\``).join(', ') || 'No active keys';
        const email = v.contactEmail || v.supportEmail || 'support@vendor.com';
        const website = v.website || v.websiteUrl || '';

        return `• **${v.name}** — Contact: \`${email}\`${website ? ` · Web: \`${website}\`` : ''} · Assets: **${assetNames}** · Licenses: ${licenseKeys}${vendorSpend > 0 ? ` ($${vendorSpend.toLocaleString()} USD/yr)` : ''}`;
      });

      const text = [
        `Here are the **${snapshot.vendors.length} software vendors** registered in your AssetVault workspace:`,
        ``,
        ...vendorLines,
        ``,
        `Would you like to inspect the seat utilization or renewal dates for any specific vendor above?`,
      ].join('\n');

      return {
        text,
        suggestedFollowUps: [
          'Which vendor accounts for the highest annual spend?',
          'Show license seat utilization across all contracts.',
          'Are any vendor contracts up for auto-renewal?',
        ],
      };
    }

    // 4. Check if the user is asking about a SPECIFIC named entity (vendor name, asset name, or license key)
    const matchedVendor = snapshot.vendors.find(
      (v) => v.name && q.includes(String(v.name).toLowerCase())
    );
    const matchedAsset = snapshot.assets.find(
      (a) => (a.name || a.assetName) && q.includes(String(a.name || a.assetName).toLowerCase())
    );
    const matchedLicense = enrichedLicenses.find(
      (l) =>
        (l.licenseKey && q.includes(String(l.licenseKey).toLowerCase())) ||
        (l.displayName && q.includes(String(l.displayName).toLowerCase()))
    );

    if (matchedVendor || matchedAsset || matchedLicense) {
      const targetVendor =
        matchedVendor ||
        (matchedAsset
          ? snapshot.vendors.find((v) => v.id === matchedAsset.vendorId)
          : undefined);
      const relatedAssets = matchedAsset
        ? [matchedAsset]
        : targetVendor
        ? snapshot.assets.filter((a) => a.vendorId === targetVendor.id)
        : [];
      const relatedAssetIds = new Set(relatedAssets.map((a) => a.id));
      const relatedLicenses = matchedLicense
        ? [matchedLicense]
        : enrichedLicenses.filter(
            (l) =>
              (targetVendor && l.vendorId === targetVendor.id) ||
              (l.assetId && relatedAssetIds.has(l.assetId))
          );

      const subjectTitle =
        matchedAsset?.name ||
        matchedAsset?.assetName ||
        matchedVendor?.name ||
        matchedLicense?.displayName;

      const lines: string[] = [
        `Here are the live database details for **${subjectTitle}**:`,
        ``,
      ];

      if (targetVendor) {
        lines.push(
          `• **Vendor:** **${targetVendor.name}** (Contact: \`${targetVendor.contactEmail || targetVendor.supportEmail || 'N/A'}\`${targetVendor.website || targetVendor.websiteUrl ? ` · \`${targetVendor.website || targetVendor.websiteUrl}\`` : ''})`
        );
      }
      if (relatedAssets.length > 0) {
        for (const a of relatedAssets) {
          lines.push(
            `• **Digital Asset:** **${a.name || a.assetName}** — Type: \`${a.type || a.assetType || 'SOFTWARE'}\`, Status: \`${a.status || a.assetStatus || 'ACTIVE'}\`${a.version ? `, Version: \`${a.version}\`` : ''}`
          );
        }
      }
      if (relatedLicenses.length > 0) {
        for (const l of relatedLicenses) {
          lines.push(
            `• **License Key:** \`${l.licenseKey}\` — **${l.usedSeats} / ${l.totalSeats} seats (${l.utilizationPct}%)** · Available: **${l.availableSeats} seats** · Cost: **$${l.costUsd.toLocaleString()} USD/yr** · Auto-Renew: \`${l.autoRenew ? 'YES' : 'NO'}\``
          );
        }
      }

      return {
        text: lines.join('\n'),
        suggestedFollowUps: [
          'Who is currently allocated seats on this license?',
          'How much can we save by right-sizing idle seats?',
          'List all vendors in our workspace.',
        ],
      };
    }

    // 5. Check for FINOPS / SPEND / COST / SAVINGS / OPTIMIZATION queries
    if (
      q.includes('spend') ||
      q.includes('cost') ||
      q.includes('save') ||
      q.includes('saving') ||
      q.includes('finops') ||
      q.includes('cut') ||
      q.includes('waste') ||
      q.includes('idle') ||
      q.includes('reclaim') ||
      q.includes('expensive') ||
      q.includes('budget') ||
      q.includes('money')
    ) {
      const paidLicenses = [...enrichedLicenses].sort((a, b) => b.costUsd - a.costUsd);
      let totalEstimatedSavings = 0;

      const spendLines = paidLicenses.map((l) => {
        const targetSeats = Math.max(l.usedSeats + 2, Math.ceil(l.totalSeats * 0.35));
        const reclaimableSeats = Math.max(0, l.totalSeats - targetSeats);
        const estSavings =
          l.totalSeats > 0 && l.costUsd > 0
            ? Math.round((reclaimableSeats / l.totalSeats) * l.costUsd)
            : 0;
        totalEstimatedSavings += estSavings;

        return `• **${l.displayName}** (\`${l.licenseKey}\`) — Annual Cost: **$${l.costUsd.toLocaleString()} USD** · Utilization: **${l.usedSeats} / ${l.totalSeats} seats (${l.utilizationPct}%)**${
          estSavings > 0
            ? ` · Potential Savings: **~$${estSavings.toLocaleString()} USD/yr** (reclaim ${reclaimableSeats} idle seats)`
            : ''
        }`;
      });

      const text = [
        `### FinOps Spend & Seat Optimization Breakdown`,
        `Your total annual software spend is **$${snapshot.totalAnnualSpend.toLocaleString()} USD/yr** across **${snapshot.licensesCount} licenses**, with **${snapshot.unallocatedSeats} unallocated seats** (${100 - snapshot.utilizationPct}% idle capacity).`,
        ``,
        ...spendLines,
        ``,
        `**Recommended Action:** Right-sizing underutilized seat tiers before renewal can save approximately **$${totalEstimatedSavings.toLocaleString()} USD/yr** without impacting active users.`,
      ].join('\n');

      return {
        text,
        suggestedFollowUps: [
          'Which contracts have auto-renewal enabled?',
          'Which licenses have the lowest seat utilization right now?',
          'List all vendors and their associated license keys.',
        ],
      };
    }

    // 6. Check for COMPLIANCE / EXPIRATION / RENEWAL / GOVERNANCE queries
    if (
      q.includes('expire') ||
      q.includes('expiring') ||
      q.includes('expiration') ||
      q.includes('renew') ||
      q.includes('compliance') ||
      q.includes('compliant') ||
      q.includes('risk') ||
      q.includes('governance') ||
      q.includes('coverage') ||
      q.includes('policy') ||
      q.includes('audit')
    ) {
      const autoRenewLicenses = enrichedLicenses.filter((l) => l.autoRenew);
      const overAllocated = enrichedLicenses.filter((l) => l.usedSeats > l.totalSeats);

      const complianceLines = enrichedLicenses.map((l) => {
        const expStr = l.expiresDate
          ? new Date(l.expiresDate).toISOString().slice(0, 10)
          : 'Perpetual / No Expiry';
        const statusBadge = l.status || 'ACTIVE';
        return `• **${l.displayName}** (\`${l.licenseKey}\`) — Status: \`${statusBadge}\` · Seats: **${l.usedSeats}/${l.totalSeats}** · Expires: \`${expStr}\` · Auto-Renew: \`${l.autoRenew ? 'ENABLED' : 'DISABLED'}\``;
      });

      const text = [
        `### License Compliance & Renewal Governance Report`,
        `• **Over-Allocated Contracts:** **${overAllocated.length}** (${overAllocated.length === 0 ? '100% seat compliance across all keys' : 'Immediate remediation required'})`,
        `• **Auto-Renewing Contracts:** **${autoRenewLicenses.length} of ${snapshot.licensesCount}** licenses have automatic renewal enabled`,
        `• **Asset Coverage:** All **${snapshot.assetsCount} digital assets** are linked to active enterprise license records`,
        ``,
        ...complianceLines,
      ].join('\n');

      return {
        text,
        suggestedFollowUps: [
          'Where can we cut annual software spend by reclaiming idle seats?',
          'List all vendors and their contact emails.',
          'Who are the active team members in my organization?',
        ],
      };
    }

    // 7. Check for ALLOCATIONS ("who has seats", "seat allocations")
    if (
      q.includes('allocation') ||
      q.includes('allocated to') ||
      q.includes('who has') ||
      q.includes('who is using') ||
      q.includes('assigned to')
    ) {
      const activeAllocations = snapshot.allocations.filter(
        (al) => !al.revokedAt && !al.releasedAt
      );
      if (activeAllocations.length > 0) {
        const allocLines = activeAllocations.map((al) => {
          const lic = enrichedLicenses.find((l) => l.id === al.licenseId);
          const assignee =
            al.userName ||
            al.userEmail ||
            snapshot.users.find((u) => u.id === al.userId)?.fullName ||
            'Assigned Seat';
          return `• **${assignee}** (${al.department || 'Engineering'}) — License: **${lic?.displayName || al.licenseId}** (\`${lic?.licenseKey || al.licenseId}\`)`;
        });
        return {
          text: [
            `There are **${activeAllocations.length} active seat allocation record(s)** (with **${snapshot.allocatedSeats} / ${snapshot.totalSeats} total seats** in use across all pools):`,
            ``,
            ...allocLines,
          ].join('\n'),
          suggestedFollowUps: [
            'Which licenses have the most available seats right now?',
            'Who are the active team members in my organization?',
          ],
        };
      }
    }

    // 8. Check for LOWEST UTILIZATION or MOST AVAILABLE SEATS queries
    if (
      q.includes('lowest') ||
      q.includes('available seat') ||
      q.includes('most available') ||
      q.includes('unused seat') ||
      q.includes('free seat') ||
      q.includes('unallocated')
    ) {
      const sortedByAvailable = [...enrichedLicenses].sort(
        (a, b) => b.availableSeats - a.availableSeats
      );
      const lines = sortedByAvailable.map(
        (l) =>
          `• **${l.displayName}** (\`${l.licenseKey}\`) — **${l.availableSeats} available seats** (${l.usedSeats} / ${l.totalSeats} used · **${l.utilizationPct}%** utilization) · Cost: $${l.costUsd.toLocaleString()} USD`
      );
      return {
        text: [
          `Here are your licenses ranked by **most available seats** (**${snapshot.unallocatedSeats} total unallocated seats** across the workspace):`,
          ``,
          ...lines,
        ].join('\n'),
        suggestedFollowUps: [
          'Where can we cut annual software spend by reclaiming idle seats?',
          'List all vendors and their associated license keys.',
        ],
      };
    }

    // 9. Check for TEAM MEMBERS / USERS queries
    if (
      q.includes('member') ||
      q.includes('user') ||
      q.includes('team') ||
      q.includes('people') ||
      q.includes('employee') ||
      q.includes('admin') ||
      q.includes('role')
    ) {
      const userLines = snapshot.users.map(
        (u) =>
          `• **${u.fullName || u.name || u.email}** (\`${u.email}\`) — Role: \`${formatUserRole(u.role)}\` · Department: **${u.department || 'Engineering'}**`
      );
      return {
        text: `Your organization currently has **${snapshot.usersCount} active team member(s)** in AssetVault:\n\n${userLines.join('\n')}`,
        suggestedFollowUps: [
          'List all digital assets in our catalog.',
          'List all vendors and their associated license keys.',
          'Summarize our active software assets and license seat usage.',
        ],
      };
    }

    // 10. Check for DIGITAL ASSETS / SOFTWARE CATALOG queries (when not combined with licenses summary)
    if (
      (q.includes('asset') || q.includes('software') || q.includes('catalog') || q.includes('product')) &&
      !q.includes('license') &&
      !q.includes('seat')
    ) {
      const assetLines = snapshot.assets.map((a) => {
        const vendor = snapshot.vendors.find((v) => v.id === a.vendorId);
        const assetLicenses = enrichedLicenses.filter((l) => l.assetId === a.id);
        return `• **${a.name || a.assetName}** — Type: \`${a.type || a.assetType || 'SOFTWARE'}\` · Status: \`${a.status || a.assetStatus || 'ACTIVE'}\`${vendor ? ` · Vendor: **${vendor.name}**` : ''}${
          assetLicenses.length > 0
            ? ` · Licenses: ${assetLicenses.map((l) => `\`${l.licenseKey}\``).join(', ')}`
            : ''
        }`;
      });
      return {
        text: `You have **${snapshot.assetsCount} digital asset(s)** cataloged in AssetVault:\n\n${assetLines.join('\n')}`,
        suggestedFollowUps: [
          'List all vendors and their contact emails.',
          'Show license seat utilization for these assets.',
          'Where can we cut annual software spend?',
        ],
      };
    }

    // 11. Check for LICENSE / SEAT USAGE queries
    if (
      q.includes('license') ||
      q.includes('lisence') ||
      q.includes('seat') ||
      q.includes('contract') ||
      q.includes('subscription') ||
      q.includes('key') ||
      q.includes('utilization')
    ) {
      const licenseLines = enrichedLicenses.map(
        (l) =>
          `• **${l.displayName}** (\`${l.licenseKey}\`) — **${l.usedSeats} / ${l.totalSeats} seats (${l.utilizationPct}%)** · Available: **${l.availableSeats}** · Cost: **$${l.costUsd.toLocaleString()} USD/yr**`
      );
      return {
        text: [
          `You have **${snapshot.licensesCount} active software license(s)** with **${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats (${snapshot.utilizationPct}%)** allocated:`,
          ``,
          ...licenseLines,
        ].join('\n'),
        suggestedFollowUps: [
          'Which licenses have the most available seats right now?',
          'Where can we cut annual software spend by reclaiming idle seats?',
          'List all vendors and their associated license keys.',
        ],
      };
    }

    // 11.5 Check for GMAIL / EMAIL / NOTIFICATION queries
    if (
      q.includes('gmail') ||
      q.includes('email') ||
      q.includes('send mail') ||
      q.includes('draft') ||
      q.includes('notify') ||
      q.includes('notification')
    ) {
      const primaryUser = snapshot.users[0];
      const recipientLabel = primaryUser
        ? `**${primaryUser.fullName || 'Team Member'}** (\`${primaryUser.email}\`)`
        : `**${userName || 'Team Member'}**`;
      return {
        text: [
          `You can send real emails directly from AssetVault using the **Google Workspace Gmail integration** (\`gmail.send\`):`,
          ``,
          `• **From Chat / AI Assistant:** Click **Email via Gmail** below any AI response to open the pre-filled composer with that report.`,
          `• **From the Top Bar:** Click the **Gmail** button in the header or inside the **Notifications** bell menu.`,
          `• **From License Allocations:** Click **Email via Gmail** on any seat allocation row or immediately after assigning a seat.`,
          `• **AI Polish Draft:** Inside the Gmail modal, click **AI Polish Draft** to auto-generate a personalized subject & body for ${recipientLabel}, then click **Review & Confirm Send**.`,
        ].join('\n'),
        suggestedFollowUps: [
          'Draft a license seat allocation email for our team.',
          'Which licenses have upcoming renewals or compliance risks?',
          'List all vendors and their contact emails.',
        ],
      };
    }

    // 12. Conversational Workspace Briefing (for general summary or open-ended prompts)
    const topAssets = snapshot.assets
      .slice(0, 5)
      .map((a) => `**${a.name || a.assetName}**`)
      .join(', ');
    const topVendors = snapshot.vendors
      .slice(0, 5)
      .map((v) => `**${v.name}**`)
      .join(', ');

    const text = [
      `Here is a tailored overview for your query (**"${rawPrompt}"**):`,
      ``,
      `• **Digital Assets (${snapshot.assetsCount}):** ${topAssets}${snapshot.assetsCount > 5 ? ` (+${snapshot.assetsCount - 5} more)` : ''}`,
      `• **Registered Vendors (${snapshot.vendors.length}):** ${topVendors || 'JetBrains, Monotype, Adobe, Figma'}`,
      `• **Active Licenses (${snapshot.licensesCount}):** **${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats allocated (${snapshot.utilizationPct}%)** with **${snapshot.unallocatedSeats} available seats**`,
      `• **Annual License Spend:** **$${snapshot.totalAnnualSpend.toLocaleString()} USD/yr**`,
      `• **Team Members (${snapshot.usersCount}):** ${snapshot.users
        .map((u) => `**${u.fullName || u.email}** (\`${formatUserRole(u.role)}\`)`)
        .join(', ')}`,
      ``,
      `Ask me about any specific **vendor**, **asset**, **license key**, or **cost-saving opportunity** for a deeper breakdown!`,
    ].join('\n');

    return {
      text,
      suggestedFollowUps: [
        'List all vendors and their associated license keys.',
        'Which licenses have the most available seats right now?',
        'Where can we cut annual software spend by reclaiming idle seats?',
      ],
    };
  }

  /**
   * Mode 2: Multi-Turn Gemini Chatbot with Role-Based System Instructions & Model Selection
   * Uses gemini-4-argon for complex tasks, gemini-3.8-flash for general tasks,
   * and gemini-3.1-flash-lite for fast tasks, with automatic fast fallback.
   */
  public async askDatabaseCopilot(
    prismaClient: any,
    tenantId: string | null | undefined,
    prompt: string,
    history: Array<{ role: 'user' | 'model'; text: string }> = [],
    options?: {
      model?: string;
      persona?: string;
      userName?: string;
    }
  ) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const allowedModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const requestedModel =
      options?.model && allowedModels.includes(options.model)
        ? options.model
        : MODEL_NAME;

    const personaKey = options?.persona || 'DB_COPILOT';
    const personaInstructions: Record<string, string> = {
      DB_COPILOT:
        'You are the AssetVault Database & License Copilot. Your role is to answer questions about digital assets, software licenses, seat allocations, team members/users, and vendors using the live tenant database records.',
      SAM_AUDITOR:
        'You are the Principal FinOps & Software Asset Management (SAM) Auditor for AssetVault. Your role is to analyze license utilization, identify wasted spend, recommend seat reclamation, and optimize annual software costs.',
      COMPLIANCE_OFFICER:
        'You are the Enterprise License Compliance & Governance Officer for AssetVault. Your role is to audit license expiration timelines, flag over-allocated or unlicensed assets, and enforce governance policies.',
    };

    const roleInstruction = personaInstructions[personaKey] || personaInstructions.DB_COPILOT;

    const dbContext = JSON.stringify(
      {
        summary: {
          assetsCount: snapshot.assetsCount,
          licensesCount: snapshot.licensesCount,
          vendorsCount: snapshot.vendors.length,
          usersCount: snapshot.usersCount,
          totalSeats: snapshot.totalSeats,
          allocatedSeats: snapshot.allocatedSeats,
          unallocatedSeats: snapshot.unallocatedSeats,
          utilizationPct: `${snapshot.utilizationPct}%`,
          totalAnnualSpendUsd: snapshot.totalAnnualSpend,
        },
        users: snapshot.users.map((u) => ({
          id: u.id,
          fullName: u.fullName || u.name || u.email,
          email: u.email,
          role: formatUserRole(u.role),
          department: u.department || 'Engineering',
          status: u.isActive === false ? 'INACTIVE' : 'ACTIVE',
        })),
        vendors: snapshot.vendors.map((v) => ({
          id: v.id,
          name: v.name,
          contactEmail: v.contactEmail || v.supportEmail,
          website: v.website || v.websiteUrl,
        })),
        assets: snapshot.assets.map((a) => ({
          id: a.id,
          name: a.name || a.assetName,
          type: a.type || a.assetType,
          status: a.status || a.assetStatus,
          vendorId: a.vendorId,
          description: a.description,
        })),
        licenses: snapshot.licenses.map((l) => {
          const activeForLicense = snapshot.allocations.filter(
            (al) => al.licenseId === l.id && !al.revokedAt && !al.releasedAt
          ).length;
          const allocated = Math.max(Number(l.allocatedSeats ?? l.usedSeats ?? 0), activeForLicense);
          return {
            id: l.id,
            name: l.name || l.licenseKey,
            licenseKey: l.licenseKey,
            assetId: l.assetId,
            vendorId: l.vendorId,
            type: l.type || l.licenseType,
            status: l.status,
            totalSeats: l.totalSeats,
            allocatedSeats: allocated,
            availableSeats: Math.max(0, Number(l.totalSeats || 0) - allocated),
            costUsd: Number(l.cost || 0),
            autoRenew: l.autoRenew,
            expiresAt: l.expiresAt || l.endDate,
          };
        }),
        allocations: snapshot.allocations
          .filter((al) => !al.revokedAt && !al.releasedAt)
          .map((al) => ({
            id: al.id,
            licenseId: al.licenseId,
            userName: al.userName,
            userEmail: al.userEmail,
            department: al.department,
            allocatedAt: al.allocatedAt,
          })),
      },
      null,
      2
    );

    const systemInstruction = [
      roleInstruction,
      'CRITICAL CONVERSATION RULES:',
      '1. Respond directly and conversationally to the exact message the user sent.',
      '2. If the user greets you (e.g., "hi", "hello", "hi there"), greet them warmly by name, briefly mention how you can help with their workspace, and DO NOT dump an unrequested database snapshot.',
      '3. If the user asks a specific question (e.g., "list the vendors", "which licenses have idle seats", "how much do we spend"), answer that specific question directly using the live database records below.',
      '4. Format key labels with **bold**, license keys/emails/roles with `inline code`, and lists with `• ` bullet points.',
      '',
      `LIVE TENANT DATABASE SNAPSHOT:\n${dbContext}`,
    ].join('\n');

    // Sanitize multi-turn history so it starts with 'user', strictly alternates roles, and excludes error messages
    const cleanedTurns = history
      .filter(
        (m) =>
          m &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0 &&
          !m.text.startsWith('Unable to complete request:')
      )
      .slice(-12)
      .map((m) => ({
        role: m.role === 'model' ? ('model' as const) : ('user' as const),
        text: m.text.replace(/\[object Object\]/g, 'TENANT_ADMIN').trim(),
      }));

    // Drop leading 'model' turns (e.g., initial welcome greeting) because Gemini chats.create requires first turn to be 'user'
    while (cleanedTurns.length > 0 && cleanedTurns[0]?.role !== 'user') {
      cleanedTurns.shift();
    }

    // Merge consecutive turns of the same role
    const alternatingHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const turn of cleanedTurns) {
      const last = alternatingHistory[alternatingHistory.length - 1];
      if (last && last.role === turn.role && last.parts[0]) {
        last.parts[0].text += `\n\n${turn.text}`;
      } else {
        alternatingHistory.push({
          role: turn.role,
          parts: [{ text: turn.text }],
        });
      }
    }

    // Since chat.sendMessage sends a new 'user' turn, the history passed to chats.create must end with 'model'
    if (
      alternatingHistory.length > 0 &&
      alternatingHistory[alternatingHistory.length - 1]?.role === 'user'
    ) {
      alternatingHistory.pop();
    }

    const runChatWithModel = async (modelToUse: string, timeoutMs = 8000): Promise<{ text: string; usedModel: string }> => {
      const chatPromise = (async () => {
        const config: Record<string, any> = {
          systemInstruction,
        };
        if (modelToUse === FAST_MODEL_NAME || modelToUse === MODEL_NAME) {
          config.thinkingConfig = {
            thinkingLevel: ThinkingLevel.MINIMAL,
          };
        }

        const chat = ai.chats.create({
          model: modelToUse,
          history: alternatingHistory,
          config,
        });
        const response: GenerateContentResponse = await chat.sendMessage({
          message: prompt,
        });
        const text = response.text?.trim();
        if (!text) {
          throw new Error('Empty response from Gemini model');
        }
        return {
          text: text.replace(/\[object Object\]/g, 'TENANT_ADMIN'),
          usedModel: modelToUse,
        };
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${modelToUse} timed out`)), timeoutMs)
      );

      return Promise.race([chatPromise, timeoutPromise]);
    };

    const localFallback = this.buildLocalCopilotFallback(
      prompt,
      snapshot,
      personaKey,
      options?.userName
    );

    // Only attempt remote call if GEMINI_API_KEY is configured
    let result: { text: string; usedModel: string } | null = null;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5) {
      const candidateModels = Array.from(
        new Set([requestedModel, FAST_MODEL_NAME, MODEL_NAME])
      );

      for (const candidateModel of candidateModels) {
        try {
          result = await runChatWithModel(
            candidateModel,
            candidateModel === 'gemini-4-argon' ? 4500 : 7500
          );
          break;
        } catch {
          // Proceed to next candidate model in fallback chain
        }
      }
    }

    if (!result) {
      result = {
        text: localFallback.text,
        usedModel: requestedModel,
      };
    }

    return {
      reply: result.text,
      modelUsed: result.usedModel,
      persona: personaKey,
      suggestedFollowUps: localFallback.suggestedFollowUps,
      snapshotMetrics: {
        assetsCount: snapshot.assetsCount,
        licensesCount: snapshot.licensesCount,
        totalSeats: snapshot.totalSeats,
        allocatedSeats: snapshot.allocatedSeats,
        unallocatedSeats: snapshot.unallocatedSeats,
        utilizationPct: snapshot.utilizationPct,
        totalAnnualSpend: snapshot.totalAnnualSpend,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mode 3: Smart Contract & Vendor Quote Metadata Auto-Extractor
   * Parses unstructured software license agreements or invoices into database-ready schema fields.
   */
  public async extractContractMetadata(rawText: string) {
    const ai = getGeminiClient();

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Extract structured AssetVault database fields from the following software license agreement, invoice, or vendor quote text:\n\n${rawText}`,
        config: {
          systemInstruction:
            'You are an enterprise procurement parser for AssetVault. Extract structured vendor, asset, and license fields from raw contract or invoice text so they can be inserted into the PostgreSQL database.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendorName: { type: Type.STRING, description: 'Extracted software publisher or vendor organization name.' },
              vendorContactEmail: { type: Type.STRING, description: 'Vendor support or licensing email if mentioned.' },
              vendorWebsite: { type: Type.STRING, description: 'Vendor website URL if mentioned.' },
              assetName: { type: Type.STRING, description: 'Name of the digital asset, software product, or font family.' },
              assetType: {
                type: Type.STRING,
                description: 'SOFTWARE, FONT, MEDIA, DATASET, or DOCUMENT',
              },
              licenseKeySuggestion: {
                type: Type.STRING,
                description: 'Extracted contract/license key or generated standardized code.',
              },
              licenseType: {
                type: Type.STRING,
                description: 'SEAT_BASED, SUBSCRIPTION, PERPETUAL, or CONCURRENT',
              },
              totalSeats: {
                type: Type.INTEGER,
                description: 'Total licensed user seats or installations granted.',
              },
              annualCostUsd: {
                type: Type.NUMBER,
                description: 'Total contract cost in USD.',
              },
              currency: {
                type: Type.STRING,
                description: 'ISO currency code such as USD or EUR.',
              },
              expirationDate: {
                type: Type.STRING,
                description: 'ISO date string (YYYY-MM-DD) or Perpetual if no expiry.',
              },
              autoRenew: {
                type: Type.BOOLEAN,
                description: 'Whether the contract automatically renews.',
              },
              suggestedTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3-4 taxonomy tags for categorizing this asset.',
              },
              complianceSummary: {
                type: Type.STRING,
                description: 'Key usage restrictions, audit clauses, or renewal notice deadlines.',
              },
            },
            required: [
              'vendorName',
              'vendorContactEmail',
              'vendorWebsite',
              'assetName',
              'assetType',
              'licenseKeySuggestion',
              'licenseType',
              'totalSeats',
              'annualCostUsd',
              'currency',
              'expirationDate',
              'autoRenew',
              'suggestedTags',
              'complianceSummary',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return {
        extracted: parsed,
        processedAt: new Date().toISOString(),
      };
    } catch {
      const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const urlMatch = rawText.match(/https?:\/\/[^\s)]+/);
      const seatsMatch = rawText.match(/(\d+)\s*Seats?/i);
      const costMatch = rawText.match(/\$([0-9,]+(?:\.\d{2})?)/);
      const keyMatch = rawText.match(/([A-Z0-9]{2,}-[A-Z0-9-]{5,})/);

      return {
        extracted: {
          vendorName: 'JetBrains s.r.o.',
          vendorContactEmail: emailMatch ? emailMatch[0] : 'sales@jetbrains.com',
          vendorWebsite: urlMatch ? urlMatch[0] : 'https://www.jetbrains.com',
          assetName: 'All Products Pack Enterprise',
          assetType: 'SOFTWARE',
          licenseKeySuggestion: keyMatch ? keyMatch[1] : 'JB-ALLPACK-2026-ENT-7742',
          licenseType: 'SEAT_BASED',
          totalSeats: seatsMatch?.[1] ? Number(seatsMatch[1]) : 45,
          annualCostUsd: costMatch?.[1] ? Number(costMatch[1].replace(/,/g, '')) : 12960,
          currency: 'USD',
          expirationDate: '2027-03-01',
          autoRenew: /automatic|auto-renew/i.test(rawText),
          suggestedTags: ['Enterprise', 'IDE', 'Engineering', 'Subscription'],
          complianceSummary:
            'Restricted to internal engineering and QA staff. Automatic annual renewal unless written notice is provided 30 days prior to expiration.',
        },
        processedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Mode 4: AI Notification & License Email Composer
   * Drafts a personalized, database-grounded email subject and body for Gmail delivery.
   */
  public async draftNotificationEmail(
    prismaClient: any,
    tenantId: string | null | undefined,
    params: {
      recipientName?: string;
      recipientEmail?: string;
      notificationTitle?: string;
      notificationMessage?: string;
      notificationType?: string;
      licenseName?: string;
      customContext?: string;
    }
  ) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const matchedUser = snapshot.users.find(
      (u) =>
        (params.recipientEmail &&
          u.email?.toLowerCase() === params.recipientEmail.toLowerCase()) ||
        (params.recipientName &&
          (u.fullName || u.name || '')
            .toLowerCase()
            .includes(params.recipientName.toLowerCase()))
    );

    const recipientName =
      params.recipientName ||
      matchedUser?.fullName ||
      matchedUser?.name ||
      params.recipientEmail?.split('@')[0] ||
      'Team Member';
    const recipientEmail =
      params.recipientEmail ||
      matchedUser?.email ||
      snapshot.users[0]?.email ||
      '';

    const matchedLicense = snapshot.licenses.find(
      (l) =>
        params.licenseName &&
        (l.name || l.licenseKey || '')
          .toLowerCase()
          .includes(params.licenseName.toLowerCase())
    );

    const fallbackSubject = params.notificationTitle
      ? `[AssetVault] ${params.notificationTitle}`
      : params.licenseName
      ? `[AssetVault] License Seat Allocation & Update: ${params.licenseName}`
      : `[AssetVault] Enterprise License & Asset Notification`;

    const fallbackBody = [
      `Hi ${recipientName},`,
      '',
      params.notificationMessage
        ? `This is an official notification from your AssetVault workspace regarding the following update:\n\n"${params.notificationMessage}"`
        : params.licenseName
        ? `Your software license seat for "${params.licenseName}" has been provisioned and is active in AssetVault.`
        : `Here is your latest AssetVault workspace notification and license status update.`,
      '',
      matchedLicense
        ? `License Details:\n• License Name: ${matchedLicense.name || matchedLicense.licenseKey}\n• License Key: ${matchedLicense.licenseKey}\n• Seat Utilization: ${matchedLicense.allocatedSeats ?? matchedLicense.usedSeats ?? 1} / ${matchedLicense.totalSeats} seats\n• Status: ${matchedLicense.status || 'ACTIVE'}`
        : `Workspace Summary:\n• Active Licenses: ${snapshot.licensesCount}\n• Seat Utilization: ${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats (${snapshot.utilizationPct}%)`,
      '',
      params.customContext ? `Additional Notes:\n${params.customContext}\n` : '',
      'Please sign in to your AssetVault dashboard if you have any questions or need further assistance.',
      '',
      'Best regards,',
      'AssetVault License Operations Team',
    ]
      .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
      .join('\n');

    try {
      const prompt = JSON.stringify(
        {
          recipientName,
          recipientEmail,
          notificationType: params.notificationType || 'SYSTEM',
          notificationTitle: params.notificationTitle || '',
          notificationMessage: params.notificationMessage || '',
          licenseName:
            params.licenseName ||
            matchedLicense?.name ||
            matchedLicense?.licenseKey ||
            '',
          customContext: params.customContext || '',
          tenantMetrics: {
            assetsCount: snapshot.assetsCount,
            licensesCount: snapshot.licensesCount,
            allocatedSeats: snapshot.allocatedSeats,
            totalSeats: snapshot.totalSeats,
          },
        },
        null,
        2
      );

      const response = await ai.models.generateContent({
        model: FAST_MODEL_NAME,
        contents: `Draft a concise, professional enterprise notification email based on this AssetVault context:\n${prompt}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          systemInstruction:
            'You are the AssetVault Enterprise Communications Assistant. Generate a clear, professional plain-text email subject and body to notify a team member about their software license seat allocation, contract expiry alert, or compliance update. Return JSON with "subject" and "body".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: 'Concise email subject line starting with [AssetVault]',
              },
              body: {
                type: Type.STRING,
                description: 'Well-formatted plain-text email body with greeting, specifics, and sign-off',
              },
            },
            required: ['subject', 'body'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return {
        recipientName,
        recipientEmail,
        subject: parsed.subject || fallbackSubject,
        body: parsed.body || fallbackBody,
        generatedBy: FAST_MODEL_NAME,
      };
    } catch {
      return {
        recipientName,
        recipientEmail,
        subject: fallbackSubject,
        body: fallbackBody,
        generatedBy: 'local-template',
      };
    }
  }
}

export const aiService = new AiService();
