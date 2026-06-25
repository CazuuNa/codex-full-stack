## 环境 Git workspace

### 环境

- Node.js
  - 版本：24.18.0
- NPM
  - 版本：11.16.0
- pnpm
  - 版本：11.9.0
- Git
  - 版本：2.41.0
- Docker
  - 版本：29.5.3
- Docker Compose
  - 版本：5.1.4

#### Node.js 的 LTS 和 Current 有什么区别？

##### Current 是最新发布的主版本

特点：
✅ 包含最新功能
✅ 最新 V8 引擎
✅ 最新 API
✅ 可以第一时间体验新特性

缺点：
❌ 稳定性不如 LTS
❌ 部分生态库可能尚未完全适配

适合：

- Node.js 核心开发者
- 开源贡献者
- 技术爱好者
- 希望尝鲜新特性的团队

##### LTS = Long Term Support（长期支持）

特点：
✅ 非常稳定
✅ 经过社区验证
✅ 大量生产环境使用
✅ npm 生态兼容最好

适合：

- 企业项目
- 生产服务器
- 大型系统
- 商业产品

#### CommonJS 和 ESM 有什么区别？

- 两个不同的模块系统

##### CommonJS

Node.js 自己发明的模块规范

```javascript
const express = require('express');
module.exports = app
```

##### ESM

ESM 是 ES6 引入的模块规范，是 CommonJS 的替代品。是JavaScript的官方标准模块规范。

```javascript
import express from 'express';
export default express;
```

##### 导入导出语法区别

- CommonJS
  - 使用 require() 导入模块
  - 使用 module.exports 导出模块

```javascript
// CommonJS 导入模块
const fs = require('fs');

// 导出
module.exports = {
  read: fs.readFileSync,
  write: fs.writeFileSync
}

// 使用
const { read, write } = require('./fs');
```

- ESM
  - 使用 import 导入模块
  - 使用 export 导出模块

```javascript
// ESM 导入模块
import fs from 'fs';

// 导出
export default {
  read: fs.readFileSync,
  write: fs.writeFileSync
}

// 使用
import { read, write } from './fs';
```

##### 文件执行方式
- CommonJS
  - 默认支持 node index.js 执行文件
  - Node 最早就是基于CommonJS
- ESM
  - 需要声明 在 package.json 中添加 type: "module" 才能使用 ESM

  ```json
  {
    "type": "module"
  }
  ```

  - 或者在执行文件时需要使用 node --mjs index.js

##### 加载机制区别

###### 编译时加载 vs 运行时加载

- CommonJS 编译时加载
  · CommonJS是动态的。只有在代码运行到 require() 语句时模块才会被同步执行并加载。这意味着可以将require() 语句放在代码的任何位置，而不会影响模块的加载顺序。包括if语句或者函数内部。
- ESM 运行时加载
  · ESM 是静态的。在JavaScript引擎解析、编译代码阶段（代码还没有开始执行），模块之间的依赖关系就已经确定。因此，import 和 export 必须处于模块顶层，不能包裹在if语句或者函数内部。但是在后来ESM引入动态导入import()，返回一个Promise，允许在运行时按需加载。

###### 加载方式：同步和异步

- CommonJS 同步加载。require() 和 module.exports() 是同步的，会阻塞代码执行, 直到模块加载完成。在Node服务器端不是问题，因为模块文件就在本地硬盘，读取速度快。但是在浏览器端会阻塞页面渲染。
- ESM 异步加载。ESM规范在设计之初就考虑浏览器环境，模块文件可能需要通过网络获取。因此，ESM的加载过程时异步的，不会阻塞主线程。它分为构建（获取模块文件，并解析为模块记录（Module Record）），实例化（在内存中分配空间，将导出的变量与导入的变量绑定在一起（即建立引用关系，此时并未执行代码，变量为 undefined）），执行（执行模块顶层代码，将真正的值填入内存空间。）三个阶段。其中构建和实例化可以并行执行。import() 是异步的，不会阻塞代码执行。在Node服务器端和浏览器端都可以正常工作。

###### 值拷贝和值引用

- CommonJS 导出的值拷贝
  · require 导出的值是输出值的拷贝（对于基本类型是浅拷贝，对于引用类型是地址拷贝）。模块一旦输出一个值，模块内部后续的变化不会影响到已经加载了这个值的外部模块。
- ESM 导出值的动态引用
  · import 导入的是模块内实际值的一个只读的活的引用（Live Read-Only Connections）。当模块内部的值变量发生变化时，外部引用的地方也会同步变化。不过外部无法直接修改这个引用（他是只读属性）

```javascript
// CommonJS 导出的值拷贝
// lib.js
let count = 0;
function inc() {
  count++;
}
module.exports = {
  count,
  inc
}

// main.js
const mod = require('./lib');
console.log(mod.count); // 0
mod.inc();
console.log(mod.count); // 0 （拷贝的值不会改变）
// ===================
// ESM 导出值的动态引用
// lib.js
export let count = 0;
export function inc() {
  count++;
}

// main.js
import { count, inc } from './lib.js';
console.log(count); // 0
inc();
console.log(count); // 1 （动态引用的值会改变）
```

###### 模块缓存：有无缓存机制

- CommonJS 有缓存机制
  · require() 语句会检查模块缓存，在第一次被 require() 加载后会被缓存。如果模块已经加载过，直接返回缓存中的模块对象，而不是重新加载模块。模块的初始化代码只会执行一次。
- ESM 无缓存机制
  · ESM 规范本身没有像 CJS 那样的缓存一说，每次调用 import() 语句会每次加载模块，而不是从缓存中获取模块对象。不过，ESM 规范通过模块记录（Module Record）保证了每个模块只被实例化和执行一次。

###### 循环依赖

当A模块依赖B模块，B模块依赖A模块时，就会形成循环依赖。

- CommonJS模块在第一次加载后会被缓存。如果遇到循环依赖，会直接去缓存里取执行到一般的 exports 对象。这意味着可能会拿到一个尚未加载完毕的、不完整的对象。
- ESM通过动态绑定机制，ESM在实例化阶段只建立了引用关系，并不关心值是什么。只要在真正调用该变量之前，该变量已经被赋值，代码就能正常运行。如果过早调用会触发类似 TDZ（Temporal Dead Zone 暂时性死区）的错误，提示未初始化。

###### 顶层 await 支持

- CommonJS: 不支持,在顶层直接使用 await 会导致语法错误，必须将其放在一个 async 函数内部。
- ESM: 支持,在顶层直接使用 await 是合法的，不会导致语法错误。这使得模块可以等待异步操作（如网络请求）完成后再继续执行，极大地简化了异步初始化逻辑。

##### __dirname 和 __filename

- CommonJS ： 直接使用

```javascript
console.log(__dirname); // /path/to/cjs-module
console.log(__filename); // /path/to/cjs-module/index.js
```

- ESM ： 不支持，没有这两个变量，需要自己创建

```javascript
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

##### JSON 导入

- CommonJS ： 直接使用 require() 或 module.exports() 导入 JSON 文件

```javascript
const packageJson = require('./package.json'); 
```

- ESM ： 使用 import() 导入 JSON 文件

```javascript
// Node 24推荐使用 with { type: 'json' } 选项
import packageJson from './package.json' with { type: 'json' };
```

#### package.json、pnpm-lock.yaml、node_modules

- package.json 项目的配置文件，包含了项目的元数据、依赖关系、脚本等。-- 项目的清单与说明书
- pnpm-lock.yaml 项目的依赖锁文件，包含了项目的依赖关系和版本信息。-- 项目依赖的绝对快照与锁
- node_modules 项目的依赖目录，存储了实际的依赖文件。-- 项目的“实体仓库”

##### package.json 项目的声明文件

它是项目的核心入口配置文件，每个Node.js项目根目录下都有一个package.json文件。它是标准的JSON格式文件，记录项目的元数据、运行脚本以及它依赖的第三方包范围。

- 身份与元信息：定义项目的名称、版本、作者、描述、许可证等。
- 依赖管理（核心作用）：在 dependencies (生产依赖) 和 devDependencies (开发依赖) 中列举出项目所需要的包及其版本范围（例如 "lodash": "^4.17.0",表示兼容4.x.x的最新版本）
- 定义入口与执行环境：定义项目的入口文件（main），以及项目的执行环境（type）。通过 main 或者 exports 字段定义模块的入口文件；通过 type 字段（值为 "module" 或 "commonjs"）指定项目的执行环境是ESM还是CommonJS。
- 项目自动化（脚本管理）：通过 scripts 字段，可以定义通用的命令脚本，例如 npm run dev、npm run build），让团队所有成员用统一的方式启动或打包项目。并为各种工具（如 ESLint、Babel）提供统一配置。
- 重要字段含义及其作用：
  - 身份标识
    - name：项目唯一名称，用于标识项目。发布到npm时，必须是唯一的。须遵循命名规范（不能有空格，小写字母，可以用 - 或者 _ ）
    - version：项目的版本号，用于标识项目的版本。遵循 语义化版本（SemVer），格式为 主版本号.次版本号.补丁号（如 1.2.3）。这是 pnpm-lock.yaml 锁定精确版本的基础。
    - private ：是否为私有项目，用于指定项目是否为私有项目。如果为 true，npm 会拒接发布该项目，通常作为公司内部的私有应用，防止误公开。
    - description：项目的描述，用于描述项目的功能和使用方法。
    - license：项目的许可证，用于标识项目的许可证类型。
  -入口与模块解析
    - type：项目的执行环境，用于指定项目的执行环境。 不写或者 "commonjs"，默认值为 CommonJS(使用 require )。值为 "module"，则为 ESM(使用 import/export ),允许顶层直接使用 await 。
    - main：用于指定项目的入口文件。项目的官方默认入口文件（通常用于CommonJS规范），比如 "main" : "./dist/index.js"。当 require("project-name") 时，会按需加载这个文件。
    - exports：现代最高级的入口控制利器（优先级高于 main）。它不仅能同时为 CJS 和 ESM 映射不同的入口，还能实现“路径封装”（隐藏内部未暴露的文件）。它不仅定义了入口，还能实现路径封装--只有显示暴露的子路径（如 "your-lib/theme"）才能被外部访问。未暴露的内部文件则无法被引用。

    ```json
    "exports": {
      ".": {
        "import": "./dist/index.js", // ESM 入口
        "require": "./dist/index.js" // CommonJS 入口
      },
      "./theme": "./dist/theme.css"
    }
    ```

    · module 不是官方标准，但打包工具如 webpack/Vite 等支持 module 字段。指向了 ESM 格式的入口，打包工具在构建前端项目时会优先读取它，以利用 Tree Shaking 功能。
  - 依赖管理
    - dependencies：生产依赖，项目上线运行时必须存在的包（如 lodash、moment、axios、React、Vue 等） -- 命令 npm install package-name  pnpm add package-name
    - devDependencies：开发依赖，仅在本地开发时需要（如测试框架Jest、代码检查工具ESLint、打包器Vite、typescript 等） -- 命令 npm install package-name  --save-dev  pnpm add package-name --save-dev  可以将 --save-dev 替换为 -D
    - peerDependencies：同伴依赖/插件依赖/宿主依赖，用于插件或者组件库，表明“我需要你的宿主环境先安装某个特定版本的包，但是自己不带”。 -- 命令 npm install package-name --save-peer  pnpm add package-name --save-peer  没有简写需要全写
      例如：写一个Vue3的组件库，就会在peerDependencies中写 "vue": "^3.0.0"。表示“我不自带Vue，请使用方确保安装了Vue3”.能避免组件库自己打包一个Vue导致与用户项目的Vue版本冲突。
    - optionalDependencies：可选依赖，即便安装失败，包管理器也不会报错中断流程（常用于某些特定操作系统才需要的底层库） -- 命令 npm install package-name --save-optional  pnpm add package-name --save-optional  可以将 --save-optional 替换为 -O
    - bundledDependencies / bundleDependencies ：打包依赖，用打包依赖列表。发布包时，会把这些依赖一起打包进最终的 tarball 文件中。bundledDependencies  -- 命令 npm install package-name --save-bundle  pnpm add package-name --save-bundle
  - 脚本管理
    - scripts：定义了一系列命令的快捷别名。可以把复杂的构建、测试命令压缩为一个简单的词。

    ```json
    "scripts": {
      "dev": "vite", // 对应运行 pnpm run dev
      "build": "tsc && vite build", // 对应运行 pnpm run build
    }
    ```

    · npm 脚本特有的 pre 和 post 钩子（如 prebuild 会在 build 前执行）
    · bin ：定义可执行文件。当你写的时一个 CLI 工具（比如 create-vite 这种可以通过命令行直接调用的工具），需要用 bin 字段把命令名称和对应的执行脚本关联起来。当你的包被安装时，这个字段指定的文件会被软链接到全局的 node_modules/.bin 目录下，或者注册为全局 CLI 命令。
  - 环境约束
    - engines : 指定项目需要的 Node.js 或者包管理器版本范围。虽然它默认只是“警告”，但在 CI/CD（持续集成）中配合工具（如 engine-strict）可以强制校验，避免因本地 Node 版本过低导致运行报错。

    ```json
    "engines": {
      "node": ">=16.0.0",
      "pnpm": ">=8.0.0"
    }
    ```

    - packageManager ：（较新的官方字段）：明确指定项目使用的包管理器及版本。Corepack（Node.js 内置）会读取这个字段，自动唤起对应版本的 pnpm/yarn，确保团队统一。
  - 高级与现代特性（bug修复利器， pnpm/npm 专项）
    - overrides（npm） / resolutions（Yarn） / pnpm.overrides：强制覆盖子依赖的版本。当你发现某个间接依赖存在安全漏洞，但又无法直接升级主库时，可以用这个字段强行将其替换为安全版本。
    - pnpm.patchedDependencies（pnpm 特有）：配合 pnpm patch 命令使用，用于记录对某个 npm 包打补丁（临时修复 Bug）的路径。
  - 发布与分发（针对要发布的库）
    - files：决定哪些文件会被包含进npm包。通常会忽略源码( src ) 和测试文件，只打包 dist 构建目录和 README -- "files": ["dist", "LICENSE", "README.md"]
    - publishConfig：发布时的专用配置。例如配置私服仓库地址（registry），或指定发布时的访问权限（access: "public"）。
  - 它没有解决的问题：由于它只定义了“宽松的版本范围”，在不同时间或不同机器上执行 pnpm install 时，可能会安装到同一个大版本下的不同小版本（如 4.17.20 变为了 4.17.21），这可能导致不可预知的 Bug。

##### pnpm-lock.yaml 依赖树的“绝对快照与锁”

- pnpm-lock.yaml 是在使用 pnpm 作为包管理器时，由系统自动生成并维护的一个 YAML 格式文件。它忠实地记录了当前项目下所有依赖、间接依赖的精确版本和物理结构。主要解决“确定性安装”和“加速重复安装”的问题。
- 锁定精确版本：它将 package.json 中每个依赖的确切版本号、下载地址（tarball 链接）和完整性校验值/安全哈希值（ Integrity ）全部记录下来。确保团队所有成员的 CI/CD 服务器安装的依赖百分百一致。
- 锁定完整依赖树（扁平化结构）：它不仅记录直接安装的包，还会记录这些包所依赖的所有间接依赖 （子依赖）的精确版本，并保存在 packages 字段下的嵌套结构中。
- 加速后续安装（pnpm 特有）：有了这个锁文件，pnpm 再次安装时不需要重新去计算依赖树和版本兼容性，直接读取锁文件就能从全局硬链接存储（Content-addressable store）中恢复 node_modules，速度极快
- 特殊情况：在关于库（ Libary ）项目：需要开发一个给他人使用的 npm 包，通常建议将 pnpm-lock.yaml 不提交（加入 .gitignore ），因为依赖范围应该给使用方的锁文件来锁定。但对于应用（ Application ）项目（如网站、后端服务），务必提交锁文件。在版本更新时，需要升级依赖，不要手动修改 pnpm-lock.yaml 而是命令操作： pnpm update (按 package.json 的范围升级并重写锁文件)  pnpm add package-name@latest(安装最新版本并自动更新锁文件)

##### node_modules 项目的“实体仓库”

- node_modules 是一个自动生成的文件夹，里面存放的是项目实际运行和开发所需要的所有第三方包的代码实体。当你运行 pnpm install 时，包管理器会下载代码并解压到这个文件夹里。
- 提供代码实体：你的项目代码中写 import from 'lodash' 时，Node.js 或构建工具需要去 node_modules 里找到 lodash 文件夹，读取里面的 index.js 文件来执行。没有它，代码无法运行。
- 实现依赖隔离：不同的项目可以有自己独立的 node_modules，即使它们依赖同一个包的不同版本，也不会互相干扰。
- pnpm 的特殊之处（硬链接与虚拟 store）：传统的 npm/yarn 会把成百上千的包直接复制到每个项目的 node_modules 中，导致硬盘爆满。而 pnpm 的 node_modules 极其聪明：它把所有的包都安全地存在电脑的全局全局存储（Global Store）中，项目里的 node_modules 只是通过硬链接（Hard Links）和符号链接（Symlinks）指向那个全局仓库。这解决了磁盘空间浪费和安装速度慢的终极痛点。

###### 最关键的差异：pnpm 的 node_modules 与众不同

- 在 npm 或 yarn 中，node_modules 是扁平化的（所有依赖平铺在最外层，即“幽灵依赖”问题的来源）。但 pnpm 的 node_modules 结构非常独特，这也是为什么它必须搭配 pnpm-lock.yaml 才能完美工作：

- 独特的“非扁平化”结构：在项目根目录的 node_modules 下，你只会看到 package.json 中直接声明的那些依赖（比如 lodash），并且它们是指向 .pnpm 文件夹的软链接（symlink）。

- 真正的物理仓库（.pnpm 文件夹）：项目根目录 node_modules 下有一个隐藏的 .pnpm 文件夹，里面以“内容寻址”的方式存储了所有依赖（直接依赖 + 间接依赖）的真实文件，并通过硬链接（hard link）从 pnpm 的全局存储中映射过来。

- 这种结构带来了一个关键改变：解决了“幽灵依赖”问题。
  - 因为平铺时，你可以直接引用没在 package.json 中声明的包；但在 pnpm 的严格结构下，如果你没在 package.json 里写，代码里就无法引用该包，强制了依赖声明的规范性。

##### Monorepo 和 pnpm Workspace 是什么？

- Monorepo( Monolithic Repository )：大仓模式/多仓模式 是一种代码管理策略，指将多个独立项目（应用、库、工具等）放到一个大仓库（ Git Repo ）中管理。
- pnpm Workspace(工作空间)：是一种技术实现方案，是pnpm内置的、用于在 Monorepo 环境下高效管理多个包（ package ）之间依赖关系的功能。通过在项目根目录下创建一个 pnpm-workspace.yaml 配置文件，来指定哪些包是工作空间中的成员，以及它们之间的依赖关系。

###### Monorepo 解决的问题

####### 存在的问题

- 传统的 Multi-repo 模式下，每个项目都有自己的代码仓库，导致代码重复，复用率极低。
- 如果有公共的组件库和业务项目，需要修改组件库时，需要同时修改业务项目的代码，这会导致代码不一致和维护成本增加。
- 多个项目依赖版本不一致，会导致构建失败或运行时错误。
- 多个项目都要独立配置构建、测试流程，重复的 CI/CD 配置

####### Monorepo 解决的问题

- 把代码放在一起共享基础设置（ ESLint、TypeScript、Jest配置、公共组件库等），避免重复配置。方便跨项目引用（直接引用源码），并且一次命令可以在所有项目中执行（批量构建、批量测试等）。

###### pnpm Workspace 解决的问题

- Monorepo 是一种思想， pnpm Workspace 是 pnpm 官方提供的、用来落地实现 Monorepo 的核心技术工具。在一个 Monorepo 中，根目录下有 packages 文件夹，里面存放的是所有的项目代码。如果是普通的 npm install 会出现重复安装多个公共依赖包，浪费磁盘空间。如果把所有依赖提升到根目录，就会出现“幽灵依赖”问题。
- 可以通过在根目录下创建一个 pnpm-workspace.yaml 配置文件来实现整体管理。

```yaml
package:
 - "packages/*" # 存放公共库，如 packages/ui, packages/utils
 - "apps/*" # 存放具体业务应用，如 apps/web, apps/admin
 - "shared/*" # 存放共享代码，如 shared/utils, shared/types
 ```

- 全局存储：pnpm 会把所有的包都安全地存在电脑的全局全局存储（Global Store）中，项目里的 node_modules 只是通过硬链接（Hard Links）和符号链接（Symlinks）指向那个全局仓库。这解决了磁盘空间浪费和安装速度慢的终极痛点。只需要在根目录执行 pnpm install 
- 依赖隔离：不同的项目可以有自己独立的 node_modules，即使它们依赖同一个包的不同版本会在 pnpm workspace 中共享，也不会互相干扰。pnpm Workspace 会严格遵循每个子项目自己的 package.json，不会像 npm/yarn 那样强行把子依赖扁平化提升到根目录。如果没有声明，是找不到依赖的。杜绝了 “幽灵依赖”
- 依赖对齐：pnpm workspace 会实现本地软连接，当 apps/web 声明依赖 shared/utils 时，pnpm 会直接在 node_modules 创建指向本地 shared/utils 的软连接。如果更新 shared/utils，apps/web 会自动使用最新的版本。

```json
// apps/web 中需要引用 shared/utils
{
    "dependencies": {
        "@shared/utils": "workspace:*"
    }
}
```

- 批量命令管理（ -- filter 参数）
  - 通过 --filter 过滤参数，精准或者批量执行子项目的命令。
  - pnpm build --filter "./packages/*" 只构建 packages 下所有项目
  - pnpm test --filter "shared/*" 只测试 shared 下所有项目
  - pnpm run dev --filter "apps/*" 只运行 apps 下所有项目的开发环境

```text
my-monorepo/
├── package.json                 # 根目录配置文件（通常声明开发依赖）
├── pnpm-workspace.yaml          # 工作空间声明
├── pnpm-lock.yaml               # 全局唯一的锁文件（锁定所有子项目依赖）
├── node_modules/                # 根目录的 node_modules（通常是公共开发工具）
├── apps/
│   ├── web/                     # 前端应用
│   │   ├── package.json         # 依赖 "workspace:*" 引用 shared
│   │   └── node_modules/        # 只有软链接，几乎没有真实文件
│   └── admin/                   # 后台管理应用
├── packages/
│   ├── shared/                  # 公共工具库
│   │   ├── package.json
│   │   └── src/
│   └── ui/                      # 公共 UI 组件库
└── .pnpm-store/                 # pnpm 全局存储（通常放在项目外，此处仅为示意）
```

###### 幽灵依赖问题

- “幽灵依赖”的出现，是 npm 为了“节省磁盘空间”和“解决 Windows 路径过长”问题，主动采用“扁平化提升”策略所带来的副作用。
- 为什么存在幽灵依赖
  - 在 npm V2 中， node_modules 是严格的树形嵌套结构：
    - 项目依赖A，A依赖B，那么 node_modules 里面就会是 A/node_modules/B.
    - 优点：每个包都有自己的依赖副本，绝对隔离，没有幽灵依赖。
    - 缺点：如果A / C 都依赖 B，那么 A / C 都会依赖 B 的副本，导致磁盘空间浪费。而且文件路径太深（node_modules/A/node_modules/B/node_modules/D），Windows 系统会报“路径过长”错误。
  - 为了解决这个嵌套依赖问题，在 npm V3 及其之后版本（包括 yarn ）引入扁平化提升（ Hoisting ）算法
    - 安装时，包管理器会尽量把所有子依赖（间接依赖）提升到最顶层的 node_modules 根目录下。这样就可以平铺所有的包，实现共享依赖，节省空间。
- 幽灵依赖怎么出现
  - 因为提升机制，导致幽灵依赖出现，假设项目只安装了 A ，而 A 依赖 B 
    - 安装前：package.json 只有 "A" : "1.0.0"
    - 安装时：npm 把 A 和 B 都提升放到顶层的 node_modules (因为B没有冲突)
    - 结果：node_modules 根目录下，同时存在 A 和 B 文件夹
    - 问题：package.json 没有 B ，但是代码中 import from "B" Node.js 也能找到它，（因为 Node 会从当前目录一直向上找 node_modules，它在根目录找到了 B）

    这个没有写在 package.json 中的包就幽灵依赖。

    更危险的是，如果未来 A 升级了，不再依赖 B，或者换了别的包，你的代码就会因为找不到 B 而直接崩溃。

- 怎么解决
  - 可以将 pnpm 来替代 npm install 幽灵依赖就会消失，因为 pnpm 用 .pnpm-store 虚拟存储+软链接，杜绝扁平化提升。
  - 如果坚持使用 npm/yarn ：
    - 方案一：工程化检测（最推荐，CI 拦截）
      - 使用 eslint-plugin-import 配置 "import/no-extraneous-dependencies": "error" 规则。 ESLint 会检查代码所有的 import/require 如果 package.json 没有，就会报错提示。
      - 使用 depcheck 工具 在 CI 流水线（如 GitHub Actions）中运行 npx depcheck，它会列出所有“未使用”和“缺失”的依赖，帮你及时发现幽灵依赖并显式安装进 package.json
    - 方案二：使用 npm 的 --legacy 或者 --strict 变体（不推荐）
      - yarn 的 nohoist 在Workspace 配置中，你可以设置某些包“不提升”，强制保持嵌套。但这只是针对特定包，维护起来极其繁琐，无法通用。
      - npm 的 overrides：只能锁定版本，无法改变“提升”带来的物理可见性。
    - 方案三：人为编码规范
      - 团队规定，所有代码都必须显式依赖 package.json 中的依赖，不能依赖 node_modules 中的依赖。
      - 依赖 code review 发现未声明的引用就要求补充 package.json
