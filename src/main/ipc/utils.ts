export function wrapIpc<T>(fn: (event: any, ...args: any[]) => Promise<T>) {
  return async (event: any, ...args: any[]) => {
    try {
      const value = await fn(event, ...args);
      return { ok: true, value };
    } catch (error: any) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
