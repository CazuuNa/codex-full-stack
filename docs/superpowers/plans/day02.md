# ts

## 原始类型

- 枚举列表 number string boolean null undefined symbol bigint

```typescript
const aNumber: number = 10;
const aString: string = 'hello';
const aBoolean: boolean = true;
const aNull: null = null;
const aUndefined: undefined = undefined;
const aSymbol: symbol = Symbol('aSymbol');
const aBigInt: bigint = 100n;
```

- 特殊说明
  - null 和 undefined 是所有类型的子类型（如果 strictNullChecks 未开启），但强烈建议开启严格模式，此时它们只能赋值给 unknown、any 或它们自己。
  - void 通常用于函数无返回，它和 never 类型不同，void 可以赋值给 never 类型，而 never 类型不能赋值给 void。它和 undefined 在严格模式下几乎等价，但是语义不同。

## 联合类型

联合类型表示一个值可以是多种类型中的一种，使用管道符 | 表示。可以在逻辑上理解成 "或"

- 特性
  - 只能访问所有类型的共有成员（例如 number 和 string 都有 toString 方法，但是无法直接调用 toUpperCase 方法）。
  - 需要配合类型收窄来操作特定分支
  - 常用于函数参数或状态定义（ status: 'success' | 'error' | 'loading' ）

```typescript
let aUnion: number | string = 10;
aUnion = 'hello'; // 可以赋值给 string 类型

type ThemeMode = 'light' | 'dark' | 'system';
let currentTheme: ThemeMode = 'light';
currentTheme = 'blue'; // 报错，'blue' 不是 ThemeMode 类型的成员

function printSomething(something: string | number) {
    // something.toUpperCase() // 报错，number 类型没有 toUpperCase 方法
    if (typeof something === 'string') {
        console.log(something.toUpperCase());
    } else {
        console.log(something.toFixed(2));
    }
}
```

## 接口

接口主要用于定义对象的结构。它是对行为的抽象，规定了一个对象必须包含哪些属性和方法。是 TypeScript 设计中最核心的契约方式。

- 特性
  - 扩展：支持多重继承（ extends A B ）
  - 声明合并：这是接口与类型别名最大的区别，同名的接口会自动合并属性。
  - 可选/只读：支持 ? 和 readonly 修饰符。
  - 牵引签名：用于定义动态属性名，例如 [key: string]: any。

```typescript
interface IUser {
    readonly id: number;
    name: string;
    age: number;
    email?: string;
    [key: string]: any;
    say(): string;
}

interface Admin extends IUser {
    permissions: string[];
}

// 声明合并
interface Box {
    width: number;
}
interface Box {
    height: number;
} // Box 接口 now 包含 width 和 height 两个属性
```

## 类型别名

用 type 关键字给任何类型起一个新名字

- 特性
  - 可以表示对象，原始类型、联合类型、元组、函数签名等
  - 不能扩展（无法继承），只能通过交叉类型（ & ）组合，但不能像接口那要 implements 实现
  - 不可声明合并，同一个作用域下不能重复定义同名别名

```typescript
// 联合类型别名
type unionStatus = 'success' | 'error' | 'loading';

// 函数类型别名
type sayHello = (name: string) => void;

// 交叉类型
type Animal = {name: string}
type Dog = Animal & {breed: string;bark():void}
```

- interface 与 type 区别
  - 相同点： 都可以定义对象/函数的结构
  - 不同点：interface 可以重复声明并自动合并，也支持 extends 关键字（ extends A B ）。type 更灵活，能表达联合类型、元组、基本类型别名，但不能重复声明。
  - 优先使用 interface 定义对象结构；使用 type 定义联合类型、元组或工具类型。

## 泛型

泛型主要用于定义可重用的组件，例如数组、函数、类等。让类型在调用时动态确定（类型参数化）。在编写函数、接口、类时，无法提前确定具体的类型，可以用一个占位符（类型参数 T ）来表示。实现代码高复用率。

- 特性
  - 类型变量 < T > < K > < V > 
  - 约束：可以对类型变量进行约束，例如 T extends number 表示 T 必须是 number 类型或其子类型。
  - 默认类型：可以给泛型参数设置默认值， < T = string >
  - 应用场景：函数、类、接口、类型别名都可以使用

```typescript
// 泛型函数：返回传入的数组的第一个元素
function getFirstElement<t>(arr: T[]): T {
    return arr[0]
}

const numArr = [1, 2, 3, 4, 5]
const firstNum = getFirstElement(numArr) // ts 自动推断出 firstNum 为 number 类型

const strArr = ['hello', 'world', 'ts']
const firstStr = getFirstElement(strArr) // ts 自动推断出 firstStr 为 string 类型

// 泛型接口：规范后端返回的数据结构
interface IResponse<Data> {
    code: number;
    msg: string;
    data: Data; // 这里的 Data 是泛型参数，根据调用时传入的具体类型而变化。是动态的
}

interface UserInfo {
    name:string;
    age:number;
}

const userResult: IResponse<UserInfo> = {
    code: 200,
    msg: 'success',
    data: {
        name: '张三',
        age: 18
    }
}

// 带约束的泛型（确保有length属性）
interface lengthwise {
    length: number;
}

function logLength<T extends lengthwise>(arg: T): T {
    console.log(arg.length);
    return arg
}
```

## 类型收窄

是 Typescript 通过代码逻辑，将宽泛的类型推导为具体的类型的过程。

- 方式
  - typeof 类型守卫 收窄原始类型(例如 string, number, boolean)
  - instabceof 收窄类实例
  - in 操作符 检查对象中是否存在某个属性
  - 可辨识联合 利用共同字段（如 type ）收窄
  - 断言函数（ is ）自定义类型保护
  - 赋值语句 let x = 'abc' 会自动收窄为字面量类型

```typescript
// 可辨识联合
type shape = {type: 'circle', radius: number} 
 | {type: 'square', side: number}
 | {type: 'rectangle', width: number, height: number}

 function getArea(shape: shape) {
    if (shape.type === 'circle') { //这里自动收窄为 circle，TS 知道存在 radius 属性，所以可以使用 radius 属性
        return Math.PI * shape.radius ** 2
    } else if (shape.type === 'square') {
        return shape.side ** 2
    } else {
        return shape.width * shape.height
    }
 }

 // 使用 in 关键字收窄 -- 用于判断对象属性
interface Bird {
    fly: () => void
}
interface Fish {
    swim: () => void
}

function move(animal: Bird | Fish) {
    if ('fly' in animal) {
        animal.fly()
    } else if ('swim' in animal) {
        animal.swim()
    }
}
```

## unkown

TS 的安全类型，和 any 一样任何类型的值都可以赋值给 unknown 类型。和 any 不同的是，unknown 类型不能直接进行任何操作（调用方法、实例化、读取属性），除非先进行类型收窄或者类型断言确认了具体类型，才可以操作。比 any 更安全。

```typescript
let value: unknown = "Hello World";

// value.toUpperCase(); // ❌ 报错：对象的类型为 "unknown"。

// 必须先进行类型收窄/断言才能使用：
if (typeof value === "string") {
  console.log(value.toUpperCase()); // ✅ 成功通过
}

// 或者使用类型断言 (Type Assertion)
const len = (value as string).length; // ✅ 成功通过

let data: unknown = JSON.parse('{"name":"TS"}');
// data.name // 报错：对象的类型为 'unknown'
if (typeof data === "object" && data !== null && "name" in data) {
  console.log((data as { name: string }).name); // 必须收窄或断言
}
```

## never

表示永远不会存在的值或者永远不会有返回的类型，它是所有类型的子类型，但没有值可以赋值给 never 类型。

- 出现场景
  - 一个函数抛出异常，没有返回值
  - 一个函数无限循环，没有返回值
  - 联合类型的穷尽检查，确保所有可能的类型都被覆盖

```typescript
// 抛出异常
function throwError(message: string): never {
    throw new Error(message);
}

// 穷尽检查：如果未来 Shape 新增了类型，这里会报错
function assertNever(value: never): never {
  throw new Error("Unexpected value: " + value);
}
function handle(shape: Shape) {
  switch (shape.kind) {
    case "circle": return 0;
    case "square": return 1;
    default: return assertNever(shape); // 如果漏掉了新类型，shape 会被推断为 never 吗？不，如果漏掉会报错，这里依靠 never 来拦截
  }
}
```

## enum

是 TypeScript 中的一种特殊类型，用于定义枚举值，编译后生成对象，定义一组具名常量

- 类型
  - 数值枚举 默认 0 开始
  - 字符串枚举 可以手动指定每个枚举值的字符串表示
  - 异构枚举 可以包含数值和字符串值
  - 常量枚举 编译时被内联替换，不生成额外的JS对象

```typescript
// 1. 数字枚举（含反向映射）
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right  // 3
}
console.log(Direction.Up); // 0
console.log(Direction[0]); // "Up" (反向映射)

// 2. 字符串枚举（无反反向映射）
enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE"
}

// 3. const 枚举（编译后直接替换为值，不产生对象）
const enum Size {
  Small = "S",
  Large = "L"
}
let mySize = Size.Small; // 编译后直接变成 "S"
```

大多数 TS 官方风格指南（如 Google、Airbnb）推荐使用联合类型（type Status = "start" | "end"） 代替枚举，因为联合类型更简洁、无编译时代码膨胀、且与 JavaScript 原生语法更贴近。仅当需要遍历枚举键值或使用反向映射时，才考虑使用数字枚举。

## 元组

元组是长度固定、且每个位置类型都明确指定的数组。普通数组（如 number[]）是“同质”的（所有元素类型都一样），而元组是“异质”的（每个元素可以不同）。

- 特性
  - 固定长度：越界访问会报错。
  - 位置类型严格：第 0 个必须是 X，第 1 个必须是 Y。
  - 可选元素（?）：支持尾部可选。
  - 剩余元素（Rest）：支持不定长度的尾部。
  - 只读元组（readonly）：防止篡改。

```typescript
// 基础元组：第0项是string，第1项是number
let person: [string, number] = ["Alice", 25];
person[0] = "Bob";   // OK
// person[0] = 123;  // 报错：不能将 number 赋给 string
// person[2] = true; // 报错：长度为 2，越界

// 可选与剩余元素（常用于函数参数）
type StringNumberBooleans = [string, number, ...boolean[]]; 
// 第一个必须是 string，第二个必须是 number，后面可以跟任意个 boolean
let arr: StringNumberBooleans = ["hello", 123, true, false, true];

let rgaColor: [number, number, number, number?]; // 第四个透明度参数可选
rgaColor = [255, 0, 0];       // ✅ 成功
rgaColor = [255, 0, 0, 0.5]; // ✅ 成功

// 只读元组（防止 push 或修改）
const readonlyPoint: readonly [number, number] = [10, 20];
// readonlyPoint.push(30); // 报错：push 不存在于 readonly 类型

// 元组解构与具名元组（提高代码可读性）
type Point2D = [x: number, y: number];
const location: Point2D = [121.5, 31.2];
```

如果你有一个 [string, number]，TS 会精确记住每个位置的类型；而 Array<string | number> 只记住“这堆东西要么是 string 要么是 number”，无法区分第 0 位和第 1 位的具体类型。元组常用于 useState 返回值、Object.entries() 或 CSV 解析。

## as 类型断言

类型断言告诉 TypeScript：“相信我，我知道这个变量实际的类型比推断出来的更具体”。它只影响编译时的类型检查，不改变运行时的真实值。

- 语法
  - `value as type`
  - < Type >value 不推荐在 React/TSX 使用，会与标签混淆
- 场景
  - 从 any/unknown 中取具体数据（如 JSON.parse）。
  - 将宽泛类型收窄为子类型（如 HTMLElement 断言为 HTMLCanvasElement）。
  - 双重断言（极少用）：先断言为 any，再断言为目标类型（强行打破类型安全，非必要不用）

```typescript
// 1. 将宽泛的类型断言为具体的类型（最常见场景：获取 DOM 元素）
// getElementById 返回的是 HTMLElement | null，但你确信它是一个图片标签
const myImg = document.getElementById("avatar") as HTMLImageElement;
myImg.src = "profile.png"; // 此时可以安全调用 HTMLImageElement 独有的属性

// 2. 将联合类型断言为其中一个具体分支
function getLength(something: string | number): number {
  if ((something as string).length) {
    return (something as string).length;
  } else {
    return something.toString().length;
  }
}

// 3. const 断言（将对象/数组的所有属性变为只读字面量）
const config = {
  host: "localhost",
  port: 8080
} as const; 
// 此时 config.host 的类型被锁死为字面量 "localhost"，且属性变为 readonly
// config.host = "api.com"; // ❌ 报错：无法分配到 "host" ，因为它是只读属性。
```