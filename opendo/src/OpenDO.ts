export abstract class OpenDO {
  private queue = Promise.resolve<any>(undefined);

  /**
   * Chaps requests into a serial queue to ensure they are processed one by one.
   */
  async fetch(request: Request): Promise<Response> {
    return (this.queue = this.queue.then(async () => {
      try {
        return await this.handleRequest(request);
      } catch (error) {
        return new Response(
          error instanceof Error ? error.message : "Internal Server Error",
          { status: 500 }
        );
      }
    }));
  }

  /**
   * The actual logic that handles the request. 
   * This should be overridden by the user.
   */
  abstract handleRequest(request: Request): Promise<Response>;
}
