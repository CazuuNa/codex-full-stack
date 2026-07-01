# 异步编程与 Node.js 事件循环

## JavaScript 调用栈

是 Javascript 引擎内部维护的一个数据结构，用于存储函数调用的上下文信息。记录当前执行到哪个函数。

因为 Javascript 是一门单线程语言，它在同一时间只能做一件事。调用栈就是用来记录当前程序执行到哪一步，执行完成之后需要回到哪里

- 规则
  - 压栈（ Push ）：当调用一个函数时，会将该函数的上下文信息推入调用栈顶。
  - 弹栈（ Pop ）：当函数执行完成时，会将该函数的上下文信息从调用栈顶弹出，控制权交给下方函数。
  - 这种操作只能从栈顶进行，叫做后进先出（ LIFO ）。

```javascript
function multiply(x, y) {
  return x * y;
}

function calculateSquare(num) {
  const result = multiply(num, num);
  return result;
}

function printSquare() {
  const finalNum = calculateSquare(5);
  console.log(finalNum);
}

printSquare();
```

- 栈动态演变顺序
  - 匿名上下文（ Global Object ）：脚本刚开始执行时，会创建一个全局对象作为上下文压入栈底。
  - 调用 printSquare() ：引擎发现它被调用，将其压入栈顶。
    - 此时栈内（从上到下）： printSquare() -> global
  - 调用 calculateSquare(5) ：在 printSquare() 内调用，将其压入栈顶。
    - 此时栈内（从上到下）： calculateSquare(5) -> printSquare() -> global
  - 调用 multiply(5, 5) ：在 calculateSquare(5) 内调用，将其压入栈顶。
    - 此时栈内（从上到下）： multiply(5, 5) -> calculateSquare(5) -> printSquare() -> global
  - multiply 执行完成，计算出结果，遇到 return 从栈顶弹出。
    - 此时栈内（从上到下）： calculateSquare(5) -> printSquare() -> global
  - calculateSquare 执行完成，计算出结果，遇到 return 从栈顶弹出。
    - 此时栈内（从上到下）： printSquare() -> global
  - 调用 console.log(finalNum) ：压入栈顶，打印完成弹出。
  - printSquare 执行完成，从栈顶弹出。
  - 清空：整个脚本执行完毕，全局上下文弹出，调用栈变空。
- 执行上下文有什么
  - 变量环境：函数内部的 var let const 声明，以及参数的值
  - 词法环境：处理 let/const 的块级作用域和闭包
  - this 指向：根据调用方式确定 this 指向

### 栈溢出

调用栈的内存容量有限（通常几 MB 到 几十 MB ），如果被压入栈的函数太多，超过最大容量，浏览器或 Node.js 会抛出错误：
Uncaught RangeError: Maximum call stack size exceeded

```javascript
// 无限递归
function recursiveFunction() {
  recursiveFunction();
}

recursiveFunction(); // 无限递归，栈溢出
```

递归（斐波那契、遍历深层树结构）时，需要设置一个终止条件，如果数据量大，最好使用 while 循环或者尾递归优化，避免栈溢出。

### 浏览器中看调用栈

日常调试，浏览器会自动记录调用栈，我们可以在控制台查看。

- console.trace()
  - 记录调用栈，从调用该方法的函数开始，记录所有调用的函数，直到全局对象。控制台会打印当前位置的调用栈轨迹。

```javascript
function foo() {
  console.trace("看看我是怎么被调用的");
}
function bar() { foo(); }
bar();
// 控制台会输出：
// console.trace() 看看我是怎么被调用的
//   at foo (script.js:2)
//   at bar (script.js:4)
//   at script.js:5
```

- Chrome 开发者工具断点
  - 点击代码行号，设置断点，当程序执行到该行时，会暂停执行，等待我们调试。

### 调用栈与 TypeScript 关联

TS 报错时，在控制台看到的堆栈追踪，就是当前时刻调用栈的快照

```typescript
function first() { second(); }
function second() { third(); }
function third() { throw new Error("Oops"); }

first();
// 报错信息：
// Error: Oops
//   at third (index.ts:3)  <- 栈顶
//   at second (index.ts:2) <- 中间
//   at first (index.ts:1)  <- 栈底
```

看到堆栈追踪（stack trace），从上往下看（栈顶 -> 栈底）。栈顶时错误爆发的地方，栈底时最初调用入口。

## 事件循环(Event Loop)

JS 是单线程，为了不让耗时任务（网络请求，定时器）卡死页面，阻塞页面响应，JS 引擎引入了事件循环（Event Loop）。
他是一个不会停止的 while 循环，当调用栈为空时，事件循环才会从任务队列获取第一个任务，压入调用栈执行。任务队列不止一个：宏任务，微任务。

### 微任务（Microtask）：由 JS 引擎自身发起、更高优先级的任务。主要存放在

- Promise.then/catch/finally 、 async/await
- MutationObserver （观察 DOM 变化）浏览器提供的一个高级 API，用于监听 DOM 变化（添加、删除、修改节点等）。在 Vue 等框架中，用于实现响应式 UI。
  - 在它之前，如果监听 DOM 变化只能用 MutationEvents ( DOMSubtreeModified )，它是同步触发的。如果脚本连续修改1000个 DOM 节点，会导致浏览器同步触发1000次，页面卡死，性能下降。
  - MutationObserver 是异步微任务，不管做多次 DOM 修改，只会动态打包积累，触发一次微任务回调。

  ```javascript
  // 1. 创建一个观察器实例，并传入回调函数
    const observer = new MutationObserver((mutationsList) => {
      console.log("DOM 真的变了！微任务触发"); // 3. 这里是微任务，最后执行
    });

  // 2. 选择一个需要监听的 DOM 节点
  const targetNode = document.getElementById("box");

  // 3. 配置要监听的内容（子节点变动、属性变动）
  observer.observe(targetNode, { attributes: true, childList: true });

  // 4. 连续修改 DOM
  console.log("同步代码：开始改 DOM");  // 1
  targetNode.style.backgroundColor = "red";
  targetNode.innerHTML = "Hello";
  console.log("同步代码：改完了");      // 2

  // 最终输出顺序：
  // "同步代码：开始改 DOM" -> "同步代码：改完了" -> "DOM 真的变了！微任务触发"
  ```

  - 场景：
    - 富文本编辑器：监控用户输入，新增删除后同步数据状态。
    - 安全水印：可以在水印被恶意删除后重新生成一个。
- queueMicrotask （自定义微任务）：现代浏览器和 Node.js 原生提供的一个标准方法。直接将一个回调函数塞进微任务队列中。
  - 没有它之前，想要人为制造一个微任务，需要借助 Promise Promise.resolve().then(() => {...}) 方法。
  - 语法比较累赘，不够语义化。
  - 创建 Promise 实例会带来内存开销
  - 它不需要创建任何 Promise 对象，直接、高效的向底层队列塞入任务。

  ```javascript
  console.log("1. 同步开始");

  // 借用 queueMicrotask 插入一个微任务
  queueMicrotask(() => {
    console.log("3. 微任务执行了");
  });

  setTimeout(() => {
    console.log("4. 宏任务定时器执行了");
  }, 0);

  console.log("2. 同步结束");

  // 🏁 输出顺序：
  // 1. 同步开始 -> 2. 同步结束 -> 3. 微任务执行了 -> 4. 宏任务定时器执行了
  ```

  - 场景：
    - 拆分同步大任务/确保安全的执行时机：数据量太大，需要拆分成多个小任务，确保每个任务都能及时执行。

### 宏任务（Macrotask）：由由宿主环境（浏览器/Node）发起的任务，优先级较低，存放在

- setTimeout 、 setInterval 、 I/O 操作 、 UI 事件 、setImmediate（Node）、MessageChannel 、DOM 事件（如 click）。

### 事件循环运行规则

- 1、执行完当前调用栈中的所有同步代码。
- 2、检查是否存在微任务，如果有则执行，直到清空所有微任务，在这期间新产生的微任务也会被清空。
- 3、执行一个宏任务，从宏任务队列取出第一个宏任务，压入调用栈执行。
- 4、执行完这单个宏任务后，立刻去检查并清空微任务队列。
- 5、循环 3 4

## 计时器 setTimeout setInterval

- 调用 setTimeout 时，浏览器会启动一个计时器线程。时间到了，会把回调函数放入宏任务队列，不是直接进入调用栈。
- 只有当调用栈空了，目前的微任务也全部清空，事件循环才会取到宏任务中的第一个 setTimeout 回调函数。
- 最小延迟限制：在浏览器中，嵌套层级过深的 setTimeout 最小间隔会被强制设置为 4ms
- 实际延迟： setTimeout(() => {}, 1000) 并不意味着“1秒后代码绝对执行”，它的真实含义是：“1秒后，把这个回调函数放进宏任务队列排队”，实际执行时间会大于等于 1000ms。当前调用栈被一个死循环霸占，时间到了回调也只能等下去。

## Promise

new Promise() 构造函数时同步执行（立即执行）的， .then()/.catch() 里面的回调才是异步微任务（只有 resolve 被调用后，才会将回调放入微任务队列）

```javascript
new Promise((resolve, reject) => {
  console.log("1. 同步开始");
  resolve("成功");
}).then((res) => {
  console.log("2. then 执行了", res);
});
// 输出顺序：1. 同步开始 -> 2. then 执行了 成功

console.log("1");

new Promise((resolve) => {
  console.log("2"); // 同步执行！
  resolve();
}).then(() => {
  console.log("3"); // 微任务！
});

console.log("4");
// 输出顺序：1 -> 2 -> 4 -> 3

```

### async/await

实际它是 Promise + 生成器）（Generator）的语法糖，他让异步代码看起来像同步代码。

- async 会隐式返回一个 Promise
- await 右侧代码是同步执行的，但是 await 下方代码会被阻断，包裹进一个 .then() 微任务中。

```javascript
async function demo() {
  console.log("A");
  await console.log("B"); // B 是同步执行的！
  console.log("C");       // C 被踢进了微任务队列！
}

demo();
console.log("D");
// 输出顺序：A -> B -> D -> C

async function test() {
  console.log('A');       // 同步
  const res = await 1;    // 遇到 await，暂停！将后续代码变成微任务
  console.log('B', res);  // 微任务
}
test();
console.log('C');
// 输出：A -> C -> B 1
// 为什么？因为 console.log('B') 被当做微任务延后了。

```

## 并发 串行

- 串行：一个接一个执行，必须等上一个结束，在执行下一个开始。总耗时 = 所有任务耗时之和
- 并发：同时发起多个（对于 I/O 密集的网络请求来说），JS 利用非阻塞 I/O 同时等待多个结果。总耗时 ≈ 最慢任务耗时。

```typescript
// 1. 串行执行 (Sequential) —— 慢！必须等前一个完事
async function serialFetch() {
  const res1 = await fetch('/api/1');
  const res2 = await fetch('/api/2'); // 等 res1 完成才发
  const res3 = await fetch('/api/3'); // 等 res2 完成才发
  return [res1, res2, res3];
}

// 2. 并发执行 (Concurrent) —— 快！一口气全发出去
async function concurrentFetch() {
  const p1 = fetch('/api/1');
  const p2 = fetch('/api/2');
  const p3 = fetch('/api/3');
  // 所有请求已同时发出，现在一起等待
  const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
  return [res1, res2, res3];
}

// 3. 并发但带“失败即停”与“全部完成”的选择
// Promise.all()：一个失败，整体 reject（快速失败）
// Promise.allSettled()：无论成败，全部返回结果（只关心最终状态）
// Promise.race()：谁先返回用谁（超时控制常用）
```

## 面试题拆解

```javascript
console.log('1'); // 同步

setTimeout(() => {
  console.log('2'); // 宏任务
}, 0);

Promise.resolve().then(() => {
  console.log('3'); // 微任务
}).then(() => {
  console.log('4'); // 微任务（链式调用，在上一个微任务执行时推入队列）
});

console.log('5'); // 同步

async function foo() {
  console.log('6'); // 同步（函数调用立即执行）
  await 0;          // 等待，后续代码变成微任务
  console.log('7'); // 微任务
}
foo();

console.log('8'); // 同步

// script start ➡️ async start ➡️ await basic ➡️ script end ➡️ promise1 ➡️ async end ➡️ promise2 ➡️ setTimeout

console.log('1'); // 同步

setTimeout(() => {
  console.log('2'); // 宏任务
}, 0);

Promise.resolve().then(() => {
  console.log('3'); // 微任务
}).then(() => {
  console.log('4'); // 微任务（链式调用，在上一个微任务执行时推入队列）
});

console.log('5'); // 同步

async function foo() {
  console.log('6'); // 同步（函数调用立即执行）
  await 0;          // 等待，后续代码变成微任务
  console.log('7'); // 微任务
}
foo();

console.log('8'); // 同步

// 1 -> 5 -> 6 -> 8 -> 3 -> 7 -> 4 -> 2
```

## Node.js 事件循环

分为六个固定阶段，

|    阶段   |    描述    |
|   timers | 执行 setTimeout / setInterval 回调 |
| pending I/O callbacks | 处理系统操作（如 TCP 错误） |
| idle，prepare | 内部使用 |
| poll | 核心阶段。在这个阶段，Node.js 会等待新的网络请求、文件读取等 I/O 事件。如果有，就立刻执行它们的回调；如果没有，且后面没有其他任务，事件循环可能会在这里阻塞等待，直到有新的 I/O 事件进来。 |
| check | 执行 setImmediate 回调 |
| close callbacks | 处理关闭事件（ socket.on('close') ）|

每个阶段执行完成切换前，必须清空微任务队列，先清空 process.nextTick （优先级最高），在清空 Promise 微任务。

和浏览器事件循环的区别

- 浏览器：事件循环是浏览器宿主环境根据 HTML5 规范自己实现
- Node.js 事件循环是完全基于地产的 libuv C语言库实现。将底层的异步 I/O 、线程池、定时器等全部交给 libuv，分为上面六个循环机制。
- 在 Node.js 中，每次执行完一个宏任务后，会检查并清空微任务队列。 并且 process.nextTick 永远在最前面。

### AbortContriller 取消并发请求

浏览器内置 API 允许创建一个 信号（ signal ），用于取消多个或一个 Fetch 请求。

```javascript
const controller = new AbortController();
const signal = controller.signal;
const fetch = fetch('/api/1', { signal });
fetch('/api/2', { signal });
fetch('/api/3', { signal });
controller.abort();
// 取消所有请求
controller.abort()

```

```javascript
let controller = null;

function search(keyword) {
  // 取消上一次请求
  if (controller) controller.abort();
  
  controller = new AbortController();
  
  fetch(`/search?q=${keyword}`, { signal: controller.signal })
    .then(res => res.json())
    .then(updateUI)
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    });
}
```

```javascript
// 批量取消所有请求
const controller = new AbortController();
const { signal } = controller;

// 同时发起多个请求，共用同一个 signal
const requests = [
  fetch('/api/user', { signal }),
  fetch('/api/posts', { signal }),
  fetch('/api/comments', { signal })
];

// 任一请求被取消，所有请求都会中止
Promise.all(requests)
  .then(responses => Promise.all(responses.map(r => r.json())))
  .then(data => console.log('所有数据:', data))
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('所有请求已被批量取消');
    }
  });

// 一键取消全部并发请求
controller.abort();
```

```javascript
// 超时控制
const controller = new AbortController();

// 5秒超时自动取消所有请求
const timeout = setTimeout(() => {
  controller.abort();
}, 5000);

Promise.all([
  fetch('/api/slow-service-a', { signal: controller.signal }),
  fetch('/api/slow-service-b', { signal: controller.signal }),
  fetch('/api/slow-service-c', { signal: controller.signal })
])
  .then(responses => Promise.all(responses.map(r => r.json())))
  .then(data => {
    clearTimeout(timeout);
    console.log('所有请求在超时前完成:', data);
  })
  .catch(err => {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.log('请求超时，已全部取消');
    }
  });
```

```javascript
// 组件卸载时发起请求
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    });
  
  // 组件卸载时取消所有请求
  return () => controller.abort();
}, []);
```

```javascript
// 自定义异步任务
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

// 使用
const controller = new AbortController();
wait(10000, controller.signal)
  .then(() => console.log('等待完成'))
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('等待被取消');
    }
  });

// 随时取消
controller.abort();
```

```javascript
class RequestManager {
  constructor(timeout = 10000) {
    this.controller = null;
    this.timeout = timeout;
  }
  
  async requestAll(urls) {
    // 取消上一次所有请求
    if (this.controller) this.controller.abort();
    
    this.controller = new AbortController();
    const { signal } = this.controller;
    
    // 超时自动取消
    const timer = setTimeout(() => this.controller.abort(), this.timeout);
    
    try {
      const results = await Promise.all(
        urls.map(url => fetch(url, { signal }).then(r => r.json()))
      );
      clearTimeout(timer);
      return results;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('请求被取消（手动或超时）');
      }
      throw err;
    }
  }
  
  cancel() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}

// 使用
const manager = new RequestManager(3000);
manager.requestAll(['/api/a', '/api/b', '/api/c'])
  .then(data => console.log(data))
  .catch(err => console.error(err.message));

// 随时手动取消
// manager.cancel();
```