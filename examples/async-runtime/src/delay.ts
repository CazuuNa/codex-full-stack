export function delay<T>(
  milliseconds: number,
  value: T
): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, milliseconds);
  });
}