// Generated by Wrangler by running `wrangler types`

interface Env {
	SECRET_KEY: "_";
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA";
	APP_NAME: "__change_me__";
	RP_ID: "localhost";
	SESSION_DURABLE_OBJECT: DurableObjectNamespace<import("./src/worker").SessionDurableObject>;
	DB: D1Database;
	ASSETS: Fetcher;
}
