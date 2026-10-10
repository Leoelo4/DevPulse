import type { RepoRef } from "@/lib/domain/types";

/**
 * Persistence boundary for tracked repositories. Everything above this interface (validation,
 * authorization, cache invalidation) is storage-agnostic and unit-tested with an in-memory store;
 * the Prisma implementation below is a thin adapter.
 */
export interface SelectionStore {
  list(userId: string): Promise<RepoRef[]>;
  /** Atomically replaces the user's whole selection. */
  replace(userId: string, repos: readonly RepoRef[]): Promise<void>;
}

/** The slice of the generated Prisma client this adapter uses (keeps the adapter easy to fake). */
export interface SelectionPrisma {
  selectedRepository: {
    findMany(args: {
      where: { userId: string };
      orderBy: { createdAt: "asc" };
      select: { owner: true; name: true };
    }): Promise<Array<{ owner: string; name: string }>>;
    deleteMany(args: { where: { userId: string } }): Promise<unknown>;
    createMany(args: {
      data: Array<{ userId: string; owner: string; name: string }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: SelectionPrisma) => Promise<T>): Promise<T>;
}

export class PrismaSelectionStore implements SelectionStore {
  constructor(private readonly prisma: SelectionPrisma) {}

  async list(userId: string): Promise<RepoRef[]> {
    return this.prisma.selectedRepository.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { owner: true, name: true },
    });
  }

  async replace(userId: string, repos: readonly RepoRef[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.selectedRepository.deleteMany({ where: { userId } });
      if (repos.length > 0) {
        await tx.selectedRepository.createMany({
          data: repos.map((repo) => ({ userId, owner: repo.owner, name: repo.name })),
          skipDuplicates: true,
        });
      }
    });
  }
}

/** In-memory store for tests and local experiments. */
export class MemorySelectionStore implements SelectionStore {
  private readonly data = new Map<string, RepoRef[]>();

  async list(userId: string): Promise<RepoRef[]> {
    return [...(this.data.get(userId) ?? [])];
  }

  async replace(userId: string, repos: readonly RepoRef[]): Promise<void> {
    this.data.set(userId, [...repos]);
  }
}
