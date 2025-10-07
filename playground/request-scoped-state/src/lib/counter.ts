export class Counter {
  value: number;
  id: string;

  constructor(initialValue = 0, id = "default") {
    this.value = initialValue;
    this.id = id;
  }

  increment() {
    this.value++;
  }

  decrement() {
    this.value--;
  }

  getValue() {
    return this.value;
  }

  getId() {
    return this.id;
  }

  reset() {
    this.value = 0;
  }
}
