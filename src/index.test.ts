import { describe, expect, test } from "@jest/globals";
import { nextBatch } from "./";

const pr = (arg: number) => {
  // return new Promise((resolve) => {
  //   resolve(arg);
  // });
  return Promise.resolve("yo");
};
describe("batch requests", () => {
  test("adding an arg to batch returns the promise that will be resolved in the next tick", async () => {
    const testBatch = nextBatch({
      key: "test",
      batchHandler: async (ids: number[]) => {
        const result = new Map<number, string>();
        ids.forEach((id) => {
          result.set(id, `val_${id}`);
        });
        return result;
      },
    });

    const val1Promise = testBatch.add(1);
    const val2Promise = testBatch.add(2);
    expect(val1Promise).toBeInstanceOf(Promise);
    expect(val2Promise).toBeInstanceOf(Promise);
  });

  test("adding args to batch resolves the promise after the next tick", async () => {
    jest.useFakeTimers();
    const testBatch = nextBatch({
      key: "test",
      batchHandler: async (ids: number[]) => {
        const result = new Map<number, string>();
        ids.forEach((id) => {
          result.set(id, `val_${id}`);
        });
        return result;
      },
    });

    const val1Promise = testBatch.add(1);
    const val2Promise = testBatch.add(2);
    jest.runAllTicks();
    await expect(val1Promise).resolves.toBe("val_1");
    await expect(val2Promise).resolves.toBe("val_2");
  });

  test("when the batch map doesn't match all the keys, boink boink.", async () => {
    jest.useFakeTimers();
    const testBatch = nextBatch({
      key: "test",
      batchHandler: async (ids: number[]) => {
        const result = new Map<number, string>();
        ids.forEach((id) => {
          if (id === 1) {
            result.set(id, `val_${id}`);
          }
        });
        return result;
      },
    });

    const val1Promise = testBatch.add(1);
    const val2Promise = testBatch.add(2);
    jest.runAllTicks();
    await expect(val1Promise).resolves.toBe("val_1");
    await expect(val2Promise).rejects.toBe(
      "value missing for arg: 2 in the returned map from batchHandler"
    );
  });
});
