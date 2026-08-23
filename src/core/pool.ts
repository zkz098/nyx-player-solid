interface QueuedTask {
  run: () => Promise<void>;
}

/** 并发池：限制同时运行的任务数（原版 ConcurrencyPool 迁移，供歌单并发初始化使用） */
export class ConcurrencyPool {
  private readonly limit: number;
  private running = 0;
  private readonly queue: QueuedTask[] = [];

  constructor(limit: number) {
    this.limit = limit;
  }

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = {
        run: async () => {
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          }
        },
      };
      if (this.running < this.limit) {
        this.runTask(task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private runTask(task: QueuedTask): void {
    this.running++;
    void task.run().finally(() => {
      this.running--;
      this.runNext();
    });
  }

  private runNext(): void {
    if (this.running < this.limit) {
      const next = this.queue.shift();
      if (next) {
        this.runTask(next);
      }
    }
  }

  get active(): number {
    return this.running;
  }

  get pending(): number {
    return this.queue.length;
  }
}

/** 便捷函数：把任意数组并发映射为结果（单项失败不中断整体） */
export function runWithPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const pool = new ConcurrencyPool(limit);
  return Promise.allSettled(items.map((item, index) => pool.add(() => fn(item, index))));
}
