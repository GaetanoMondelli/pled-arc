import type { ExecutionDocument } from '@/lib/firestore-types';

// Server-side in-memory store for executions
// In production, this would be replaced with a database
class ExecutionStore {
  private executions: ExecutionDocument[] = [];

  getAll(templateId?: string): ExecutionDocument[] {
    if (templateId) {
      return this.executions.filter(exec => exec.templateId === templateId);
    }
    return this.executions;
  }

  get(executionId: string): ExecutionDocument | undefined {
    return this.executions.find(exec => exec.id === executionId);
  }

  create(execution: ExecutionDocument): ExecutionDocument {
    this.executions.push(execution);
    return execution;
  }

  update(executionId: string, updates: Partial<ExecutionDocument>): ExecutionDocument | null {
    const index = this.executions.findIndex(exec => exec.id === executionId);
    if (index === -1) return null;

    this.executions[index] = {
      ...this.executions[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.executions[index];
  }

  delete(executionId: string): boolean {
    const index = this.executions.findIndex(exec => exec.id === executionId);
    if (index === -1) return false;

    this.executions.splice(index, 1);
    return true;
  }
}

// Singleton instance
export const executionStore = new ExecutionStore();