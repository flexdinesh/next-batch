type BatchHandler<K, V> = (key: K[]) => Promise<Map<K, V>>;
type CleanupHandler = () => void;
type BatchTask<K, V> = {
  arg: K;
  resolve: (value: V | PromiseLike<V>) => void;
  reject: (reason?: any) => void;
};

class BatchScheduler<K = any, V = any> {
  id: string;
  isBatchScheduledForNextTaskQueue: boolean;
  nextBatch: Map<K, BatchTask<K, V>>;
  batchHandler: BatchHandler<K, V> | null = null;
  cleanupHandler: CleanupHandler | null = null;

  constructor({
    id,
    batchHandler,
    cleanupHandler,
  }: {
    id: string;
    batchHandler?: BatchHandler<K, V>;
    cleanupHandler?: CleanupHandler;
  }) {
    this.id = id;
    this.isBatchScheduledForNextTaskQueue = false;
    this.nextBatch = new Map<K, BatchTask<K, V>>();
    if (batchHandler) {
      this.batchHandler = batchHandler;
    }
    if (cleanupHandler) {
      this.cleanupHandler = cleanupHandler;
    }
  }

  setBatchHandler(handler: BatchHandler<K, V>) {
    this.batchHandler = handler;
  }

  setCleanupHandler(handler: CleanupHandler) {
    this.cleanupHandler = handler;
  }

  async flushBatch() {
    if (typeof this.batchHandler !== "function") {
      throw new Error(`batchHandler not setup for current batch: ${this.id}`);
    }

    const batchedArgs = [...this.nextBatch.keys()];
    const result = await this.batchHandler(batchedArgs);
    batchedArgs.forEach((arg, i) => {
      const value = result.get(arg);
      if (value) {
        this.nextBatch.get(arg)?.resolve(value);
      } else {
        this.nextBatch
          .get(arg)
          ?.reject(
            `value missing for arg: ${arg} in the returned map from batchHandler`
          );
      }
    });

    if (typeof this.cleanupHandler === "function") {
      this.cleanupHandler();
    }
  }

  async add(arg: K) {
    return new Promise<V>((resolve, reject) => {
      const task = {
        arg,
        resolve,
        reject,
      };
      this.nextBatch.set(arg, task);

      if (!this.isBatchScheduledForNextTaskQueue) {
        this.isBatchScheduledForNextTaskQueue = true;
        const batchCallback = () => {
          this.flushBatch();
        };

        if (
          typeof process === "object" &&
          typeof process.nextTick === "function"
        ) {
          process.nextTick(batchCallback);
        } else if (typeof setImmediate === "function") {
          setImmediate(batchCallback);
        } else {
          setTimeout(batchCallback);
        }
      }
    });
  }
}

export const nextBatch = <K = any, V = any>({
  key,
  batchHandler,
}: {
  key: string;
  batchHandler: (key: Array<K>) => Promise<Map<K, V>>;
}) => {
  globalThis.__batches = globalThis.__batches
    ? globalThis.__batches
    : new Map<K, V>();
  const batches = globalThis.__batches;
  let batch: BatchScheduler<K, V> = batches.get(key);
  if (!batch) {
    batch = new BatchScheduler<K, V>({
      id: key,
    });
    batches.set(key, batch);
  }
  if (typeof batch.batchHandler !== "function") {
    batch.setBatchHandler(batchHandler);
  }
  if (typeof batch.cleanupHandler !== "function") {
    batch.setCleanupHandler(() => {
      batches.delete(key);
    });
  }
  return batch;
};

export const __internal = {
  BatchScheduler,
};

declare global {
  namespace globalThis {
    var __batches: Map<any, any>;
  }
}
