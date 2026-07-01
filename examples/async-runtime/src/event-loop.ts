const events: string[] = [];

function record(event: string): void {
  events.push(event);
  console.log(event);
}

record('1: synchronous start');

setTimeout(() => {
  record('5: timer');
}, 0);

Promise.resolve()
  .then(() => {
    record('3: promise microtask');
  })
  .then(() => {
    record('4: chained microtask');
  });

record('2: synchronous end');

setTimeout(() => {
  console.log('final order:', events);
}, 10);

// 输出： 1: synchronous start
// 2: synchronous end
// 3: promise microtask
// 4: chained microtask
// 5: timer
// final order: 1: synchronous start, 2: synchronous end, 3: promise microtask, 4: chained microtask, 5: timer