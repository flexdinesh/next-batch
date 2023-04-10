# next-batch

A promise batching utility mostly used in GraphQL resolvers to avoid N + 1 data fetching

## Install

```sh
npm add next-batch
```

## Usage

```ts
import { nextBatch } from "next-batch";

// in your resolvers
User: {
  tasks: async ({ id: userId }, _args, context) => {
    // batch to collect all resolver requests that are flushed
    // in the next execution frame using process.nextTick()
    const tasksBatch = nextBatch({
      // unique string key to collect all promises into a single batch
      key: "tasks",
      // batchHandler is the callback that will be invoked when the batch
      // is flushed in the next tick. All keys from taskBatch.add(key)
      // will be collected as an array and sent as an argument to this
      // batchHandler callback
      batchHandler: async (keys: { id: number }[]) => {
        const tasks = await taskDB.findByUserIds({
          ids: keys.map((key) => key.id),
        });
        // batch handler should return a Map with every key in keys arg
        // and its corresponding value as a map entry.
        // remember to use the same key reference and don't deconstruct
        // and construct a new object as map key
        const result = new Map<typeof keys[number], { title: string }>();
        keys.forEach((key) => {
          const task = tasks.filter((task) => task.id === key.id);
          result.set(key, task);
        });
        return result;
      },
    });
    // tasks are requested per user but resolved in batch for all users
    // via the JavaScript magic of our next-batch util
    const tasks = await tasksBatch.add({ id: userId });
    return tasks;
  };
}
```

## License

MIT © [Dinesh Pandiyan](https://github.com/flexdinesh)
