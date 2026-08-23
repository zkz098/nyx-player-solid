import { describe, expect, it } from "vitest";
import { ConcurrencyPool, runWithPool } from "@/core/pool";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConcurrencyPool", () => {
  it("limits concurrent tasks to limit", async () => {
    const pool = new ConcurrencyPool(2);
    const gates = [deferred<number>(), deferred<number>(), deferred<number>(), deferred<number>()];
    const order: number[] = [];

    const tasks = gates.map((gate, i) =>
      pool.add(async () => {
        order.push(i);
        await gate.promise;
        return i;
      }),
    );

    // 前两个立即运行
    expect(order).toEqual([0, 1]);
    expect(pool.active).toBe(2);
    expect(pool.pending).toBe(2);

    gates[0]?.resolve(0);
    gates[1]?.resolve(1);
    gates[2]?.resolve(2);
    gates[3]?.resolve(3);

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3]);
    expect(pool.active).toBe(0);
    expect(pool.pending).toBe(0);
  });

  it("propagates rejection to caller", async () => {
    const pool = new ConcurrencyPool(2);
    await expect(
      pool.add(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
  });
});

describe("runWithPool", () => {
  it("settles all even when some reject", async () => {
    const results = await runWithPool([1, 2, 3], 2, async (n) => {
      if (n === 2) {
        throw new Error("bad");
      }
      return n * 10;
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]?.status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
  });
});
