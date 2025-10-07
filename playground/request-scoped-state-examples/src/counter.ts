// Simple stateful object to test request-scoped state
export class Counter {
  private value: number = 0;
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  increment(): number {
    this.value++;
    return this.value;
  }

  decrement(): number {
    this.value--;
    return this.value;
  }

  getValue(): number {
    return this.value;
  }

  getRequestId(): string {
    return this.requestId;
  }

  reset(): void {
    this.value = 0;
  }
}
