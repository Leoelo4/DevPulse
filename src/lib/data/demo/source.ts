import type { RepositorySnapshot } from "@/lib/domain/types";
import type { DashboardDataSource } from "../source";
import { generateDemoSnapshot, generateDemoSnapshots } from "./generate";

/** Serves clearly labelled, locally generated sample data. Never touches the network. */
export class DemoDataSource implements DashboardDataSource {
  readonly mode = "demo" as const;

  constructor(private readonly now: Date = new Date()) {}

  async getSnapshots(): Promise<RepositorySnapshot[]> {
    return generateDemoSnapshots(this.now);
  }

  async getSnapshot(owner: string, name: string): Promise<RepositorySnapshot | null> {
    return generateDemoSnapshot(owner, name, this.now);
  }
}
