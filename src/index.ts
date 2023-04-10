type BatchHandler<K, V> = (keys: K[]) => Promise<Map<K, V>>;
type CleanupHandler = () => void;
type BatchTask<K, V> = {
  key: K;
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

    const keys = [...this.nextBatch.keys()];
    const result = await this.batchHandler(keys);
    const keysFromHandler = [...result.keys()];
    // making sure users don't destructure and send a newly constructed key
    // for object keys from batchHandler
    const didAnyKeyMatch = [...this.nextBatch.keys()].some((key) =>
      keysFromHandler.find((k) => k === key)
    );

    if (!didAnyKeyMatch) {
      keys.forEach((key, i) => {
        const task = this.nextBatch.get(key);
        task?.reject(
          `No task was found in batch for: ${key}. 
          You might have probably destructured and reconstructed the argument while setting it as Map key in batchHandler.
          batchHandler map keys are original references to the yourBatch.add(key) key. 
          Please use the same reference to set map keys while returning the Map from batchHandler.`
        );
      });
    } else {
      keys.forEach((key) => {
        const task = this.nextBatch.get(key);
        const value = result.get(key);
        if (value) {
          task?.resolve(value);
        } else {
          task?.reject(
            `value missing for key: ${key} in the returned Map from batchHandler`
          );
        }
      });
    }

    if (typeof this.cleanupHandler === "function") {
      this.cleanupHandler();
    }
  }

  async add(key: K) {
    return new Promise<V>((resolve, reject) => {
      const task = {
        key,
        resolve,
        reject,
      };
      this.nextBatch.set(key, task);

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
  batchHandler: (keys: K[]) => Promise<Map<K, V>>;
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
