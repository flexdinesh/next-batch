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
      // is flushed in the next tick. All arguments in taskBatch.add(arg)
      // will be collected as an array and sent as an arg to this
      // batchHandler callback
      batchHandler: async (ids: number[]) => {
        const tasks = await task.findByUserIds(fastify.db, context.reply, {
          ids,
        });
        // batch handler should return a Map with every arg in taskBatch.add(arg)
        // and its corresponding value as a map entry.
        const map = new Map<number, { title: string }>();
        ids.forEach((id) => {
          const task = tasks.filter((task) => task.id === id);
          map.set(id, task);
        });
        return map;
      },
    });
    // tasks are requested per user but resolved in batch for all users
    // via the JavaScript magic of our next-batch util
    const tasks = await tasksBatch.add(userId);
    return tasks;
  };
}
```

## License

MIT © [Dinesh Pandiyan](https://github.com/flexdinesh)
