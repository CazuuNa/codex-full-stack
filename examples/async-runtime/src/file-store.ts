import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FileUrlToPathOptions, fileURLToPath } from 'node:url';

import crypto from 'node:crypto';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type Task = {
    id: string;
    title: string;
    status: TaskStatus;
    createdAt: string;
};

type TaskFile = {
    tasks: Task[];
};

class DomainError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'DomainError';
    }
}

// 获取当前文件所在目录
function getCurrentDir(): string {
    const currentFile = fileURLToPath(import.meta.url);
    return path.dirname(currentFile);
}

// 获取默认任务文件路径
function getDefaultStorePath(): string {
    const currentDir = getCurrentDir();
    return path.resolve(currentDir, '..', 'data', 'tasks.json');
}

// 获取任务文件路径
function getStorePath(): string {
    return process.env['TASK_STORE_PATH'] ?? getDefaultStorePath();
}

// 校验任务状态是否有效
function isTaskStatus(value: unknown): value is TaskStatus {
    return typeof value === 'string' && ['TODO', 'IN_PROGRESS', 'DONE'].includes(value);
}

// 校验任务是否有效
function isTask(value: unknown): value is Task {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const item = value as Record<string, unknown>;
    return typeof item['id'] === 'string' && typeof item['title'] === 'string' && isTaskStatus(item['status']) && typeof item['createdAt'] === 'string';
}

function parseTaskFile(content: string): TaskFile {
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch (error) {
        throw new DomainError('TASK_FILE_INVALID_JSON', error instanceof Error ? error.message : 'Invalid JSON');
    }

    if (typeof parsed !== 'object' || parsed === null) {
        throw new DomainError('TASK_FILE_INVALID_SHAPE', 'Task file must be an object');
    }

    const data = parsed as Record<string, unknown>;

    if (!Array.isArray(data['tasks'])) {
        throw new DomainError('TASK_FILE_INVALID_SHAPE', 'tasks must be an array');
    }

    for (const task of data['tasks']) {
        if (!isTask(task)) {
            throw new DomainError('TASK_FILE_INVALID_SHAPE', 'tasks must be an array of valid tasks');
        }
    }

    return {
        tasks: data['tasks'],
    };
}

// 校验错误是否为Node错误
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

// 确保任务文件存在
async function ensureStoreFile(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });

    const initialContent: TaskFile = {
        tasks: [],
    };

    await writeFile(filePath, `${JSON.stringify(initialContent, null, 2)}\n`, 'utf-8');
}

async function readTaskFile(filePath: string): Promise<TaskFile> {
    try {
        const content = await readFile(filePath, 'utf-8'); // 读取文件内容
        return parseTaskFile(content);
    } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
            throw new DomainError('TASK_FILE_NOT_FOUND', `File not found: ${filePath}`);
        }
        throw error;
    }
}

// 写入任务文件
async function writeTaskFile(filePath: string, taskFile: TaskFile): Promise<void> {
    const dir = path.dirname(filePath); // 获取文件所在目录
    await mkdir(dir, { recursive: true }); // 确保目录存在
    await writeFile(filePath, `${JSON.stringify(taskFile, null, 2)}\n`, 'utf-8'); // 写入文件内容
}

// 创建任务
function createTask(title: string): Task {
    const normalizedTitle = title.trim(); // 移除首尾空格
    if (normalizedTitle === '') {
        throw new DomainError('TASK_TITLE_EMPTY', 'Task title cannot be empty');
    }
    return {
        id: crypto.randomUUID(),
        title: normalizedTitle,
        status: 'TODO',
        createdAt: new Date().toISOString(),
    };
}

async function addTask(filePath: string, title: string): Promise<Task> {
    const taskFile = await readTaskFile(filePath);
    const task = createTask(title);

    const nextFile: TaskFile = {
        tasks: [...taskFile.tasks, task],
    };
    await writeTaskFile(filePath, nextFile);
    return task;
}

function printError(error: unknown): void {
    // 打印域错误
    if (error instanceof DomainError) {
        console.log(`[domain error] ${error.code}: ${error.message}`);
        return;
    }

    // 打印Node错误
    if (isNodeError(error)) {
        console.error(`[node error] ${error.code ?? 'UNKNOWN'}: ${error.message}`);
        return;
    }

    // 打印程序错误
    if (error instanceof Error) {
        console.error(`[program error] ${error.name}: ${error.message}`);
        return;
    }

    // 打印未知错误
    console.log(`[unknown error] ${error}`);
}

async function main(): Promise<void> {
    const filePath = getStorePath();
    const command = process.argv[2]; // 获取命令行参数
    if (command === 'init') {
        // 初始化任务文件
        await ensureStoreFile(filePath); // 确保任务文件存在
        console.log(`[init] ${filePath}`);
        return;
    }

    if (command === 'list') {
        // 列出所有任务
        const taskFile = await readTaskFile(filePath); // 读取任务文件

        if (taskFile.tasks.length === 0) {
            console.log('No tasks found.');
            return;
        }

        for (const task of taskFile.tasks) {
            console.log(`${task.id} | ${task.status} | ${task.title}`);
        }
        return;
    }

    if (command === 'add') {
        // 添加任务
        const title = process.argv.slice(3).join(' ');
        const task = await addTask(filePath, title);
        console.log(`[add] ${task.id} | ${task.status} | ${task.title}`);
        return;
    }
    console.log('  node dist/file-store.js init');
    console.log('  node dist/file-store.js list');
    console.log('  node dist/file-store.js add <title>');
}

process.on('SIGINT', () => {
    // 处理SIGINT信号
    console.log('');
    console.log('[signal] SIGINT received');
    process.exitCode = 130;
});

process.on('SIGTERM', () => {
    // 处理SIGTERM信号
    console.log('[signal] SIGTERM received');
    process.exitCode = 143;
});

try {
    await main();
} catch (error) {
    printError(error);
    process.exitCode = 1;
}
