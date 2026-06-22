export type InsightSeverity = "info" | "low" | "med" | "high";

export interface ToolTarget {
  label: string;
  calls: number;
  tokenShare: number;
}

export interface ToolBehavior {
  tool: string;
  calls: number;
  totalTokens: number;
  avgOutputTokens: number;
  costUsd: number;
  errorCount: number;
  errorRate: number;
  repeatRate: number;
  largestResultTokens: number;
  topTargets: ToolTarget[];
  confidence: number;
  estimated?: boolean;
}

export interface TurnEfficiency {
  turnIndex: number;
  turnId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  inputOutputRatio: number | null;
  toolCallCount: number;
  contextTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  flags: Array<"edit" | "test" | "error" | "simple">;
}

export interface BehaviorSuggestion {
  id: string;
  severity: InsightSeverity;
  title: string;
  evidence: Record<string, unknown>;
  action: string;
  confidence: number;
  relatedFindingIds?: string[];
}

export interface BehaviorInsights {
  toolBehavior: ToolBehavior[];
  toolInventory?: {
    loaded: number;
    used: number;
    idle: number;
    estimated: boolean;
  };
  turnEfficiency: TurnEfficiency[];
  suggestions: BehaviorSuggestion[];
}
