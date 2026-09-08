import { Signal, SignalMediaItem, AIOperationRecord } from '@civicpulse/shared';
import { getDatabaseProvider, SignalFilterCriteria } from '../../providers';

export class SignalRepository {
  private get db() {
    return getDatabaseProvider();
  }

  async create(signal: Signal): Promise<Signal> {
    return this.db.createSignal(signal);
  }

  async findById(id: string): Promise<Signal | null> {
    return this.db.getSignal(id);
  }

  async update(id: string, updates: Partial<Signal>): Promise<Signal> {
    return this.db.updateSignal(id, updates);
  }

  async list(filter: SignalFilterCriteria): Promise<{ data: Signal[]; nextCursor?: string }> {
    return this.db.listSignals(filter);
  }

  async createMedia(media: SignalMediaItem): Promise<SignalMediaItem> {
    return this.db.createSignalMedia(media);
  }

  async getMedia(signalId: string): Promise<SignalMediaItem[]> {
    return this.db.getSignalMedia(signalId);
  }

  async attachMedia(signalId: string, mediaId: string): Promise<void> {
    return this.db.attachMediaToSignal(signalId, mediaId);
  }

  async createAIOperation(op: AIOperationRecord): Promise<AIOperationRecord> {
    return this.db.createAIOperation(op);
  }

  async getAIOperations(entityId: string): Promise<AIOperationRecord[]> {
    return this.db.getAIOperations(entityId);
  }
}

