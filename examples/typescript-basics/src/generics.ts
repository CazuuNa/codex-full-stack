export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

// 创建分页结果
export function createPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
    return {
        items,
        total,
        page,
        pageSize,
    };
}

// 获取分页结果的第一个元素
export function firstItem<T>(items: readonly T[]): T | undefined {
    return items[0];
}

