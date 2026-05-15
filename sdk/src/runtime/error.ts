export class ErrorResponse extends Error {
  name = "ErrorResponse";

  constructor(
    public code: number,
    public message: string,
  ) {
    super(message);
  }
}
