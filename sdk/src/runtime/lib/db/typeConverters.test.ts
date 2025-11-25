import { CompiledQuery } from "kysely";
import { describe, expect, it, vi } from "vitest";
import { DOWorkerDialect } from "./DOWorkerDialect.js";
import { TypeConverters } from "./typeConverters.js";

describe("DOWorkerDialect TypeConverters", () => {
  it("should serialize parameters and parse results using type converters", async () => {
    const typeConverters: TypeConverters = {
      Date: {
        // Match columns ending in 'At' for parsing
        match: (col) => col.endsWith("At"),
        parse: (value: any) => (value ? new Date(value) : null),
        // Match Date objects for serialization (by constructor name)
        serialize: (value: Date | null) => (value ? value.toISOString() : null),
      },
    };

    const mockExecuteQuery = vi.fn().mockResolvedValue({
      rows: [
        { id: 1, createdAt: "2023-01-01T00:00:00.000Z" },
        { id: 2, createdAt: null },
      ],
    });

    const dialect = new DOWorkerDialect({
      kyselyExecuteQuery: mockExecuteQuery,
      typeConverters,
    });

    const driver = dialect.createDriver();
    const connection = await driver.acquireConnection();

    const dateParam = new Date("2023-01-01T00:00:00.000Z");

    // Test execution
    const result = await connection.executeQuery({
      sql: "INSERT INTO todos (createdAt) VALUES (?)",
      parameters: [dateParam],
      query: {} as any,
      queryId: {} as any,
    } as CompiledQuery<unknown>);

    // Verify serialization
    expect(mockExecuteQuery).toHaveBeenCalledWith({
      sql: "INSERT INTO todos (createdAt) VALUES (?)",
      parameters: ["2023-01-01T00:00:00.000Z"],
    });

    // Verify parsing
    const rows = result.rows as any[];
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect((rows[0].createdAt as Date).toISOString()).toBe(
      "2023-01-01T00:00:00.000Z",
    );
    expect(rows[1].createdAt).toBeNull();
  });

  it("should handle matchers in type converters", async () => {
    const typeConverters: TypeConverters = {
      Boolean: {
        match: (col) => col.startsWith("is"),
        parse: (value: number) => value === 1,
        serialize: (value: boolean) => (value ? 1 : 0),
      },
    };

    const mockExecuteQuery = vi.fn().mockResolvedValue({
      rows: [{ isDone: 1, isActive: 0, count: 5 }],
    });

    const dialect = new DOWorkerDialect({
      kyselyExecuteQuery: mockExecuteQuery,
      typeConverters,
    });

    const driver = dialect.createDriver();
    const connection = await driver.acquireConnection();

    const result = await connection.executeQuery({
      sql: "SELECT * FROM todos",
      parameters: [],
      query: {} as any,
      queryId: {} as any,
    } as CompiledQuery<unknown>);

    const rows = result.rows as any[];
    expect(rows[0].isDone).toBe(true);
    expect(rows[0].isActive).toBe(false);
    expect(rows[0].count).toBe(5); // Should not be touched
  });
});
