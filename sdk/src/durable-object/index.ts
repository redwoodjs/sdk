import { DurableObject } from "cloudflare:workers";

export interface DOContext<TState = any> {
  state: TState;
  setState: (partial: Partial<TState>) => void;
  broadcast: (message: any) => void;
  call: (actionName: string, ...args: any[]) => Promise<any>;
  env: any;
  db: any;
  sessions: Set<WebSocket>;
  ctx: DurableObjectState;
}

export interface DOConfig<TState, TActions, TAlarms = {}> {
  state: TState | (() => TState);
  actions: {
    [K in keyof TActions]: (this: DOContext<TState>, ...args: any[]) => any;
  };
  alarms?: {
    [K in keyof TAlarms]: (this: DOContext<TState>) => any;
  };
}

export function defineDO<
  TState extends Record<string, any>,
  TActions extends Record<string, any>,
  TAlarms extends Record<string, any> = Record<string, any>
>(config: DOConfig<TState, TActions, TAlarms>): typeof DurableObject {
  return class extends DurableObject {
    state!: TState;
    sessions = new Set<WebSocket>();
    env: any;
    db: any;
    currentAlarm: string | null = null;
    
    constructor(state: DurableObjectState, env: any) {
      super(state, env);
      this.env = env;
      this.db = env.db;
      
      this.ctx.blockConcurrencyWhile(async () => {
        const stored = await this.ctx.storage.get<TState>('state');
        this.state = stored || (typeof config.state === 'function' 
          ? (config.state as () => TState)()
          : { ...config.state } as TState);
        
        this.currentAlarm = (await this.ctx.storage.get<string>('currentAlarm')) ?? null;
      });
    }
    
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket();
      }
      
      if (url.pathname.startsWith('/action/')) {
        const actionName = url.pathname.replace('/action/', '');
        return await this.executeAction(actionName, request);
      }
      
      if (url.pathname === '/state') {
        return Response.json({ state: this.state });
      }
      
      return new Response('Not found', { status: 404 });
    }
    
    async executeAction(actionName: string, request: Request): Promise<Response> {
      const action = config.actions[actionName];
      if (!action) {
        return new Response(`Action ${actionName} not found`, { status: 404 });
      }
      
      const body = request.method === 'POST' ? await request.json() as { args?: any[] } : {};
      const args = body.args || [];
      
      const context = this.createContext();
      const boundAction = action.bind(context);
      
      try {
        const result = await boundAction(...args);
        return Response.json({ success: true, result });
      } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }
    
    async alarm() {
      if (this.currentAlarm && config.alarms) {
        const alarm = config.alarms[this.currentAlarm];
        if (alarm) {
          const context = this.createContext();
          const boundAlarm = alarm.bind(context);
          
          try {
            await boundAlarm();
          } catch (error) {
            console.error(`Alarm ${this.currentAlarm} error:`, error);
          }
        }
      }
    }
    
    createContext(): DOContext<TState> {
      return {
        state: this.state,
        setState: this.setState.bind(this),
        broadcast: this.broadcast.bind(this),
        call: this.call.bind(this),
        env: this.env,
        db: this.db,
        sessions: this.sessions,
        ctx: this.ctx,
      };
    }
    
    setState(partial: Partial<TState>) {
      this.state = { ...this.state, ...partial };
      this.ctx.storage.put('state', this.state);
      this.broadcast({ type: 'STATE', state: this.state });
    }
    
    async call(actionName: string, ...args: any[]) {
      const action = config.actions[actionName];
      if (!action) throw new Error(`Action ${actionName} not found`);
      
      const context = this.createContext();
      const boundAction = action.bind(context);
      return await boundAction(...args);
    }
    
    broadcast(message: any) {
      const json = JSON.stringify(message);
      this.sessions.forEach(ws => {
        try {
          ws.send(json);
        } catch {
          this.sessions.delete(ws);
        }
      });
    }
    
    handleWebSocket(): Response {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      this.sessions.add(server);
      server.accept();
      
      server.send(JSON.stringify({ type: 'STATE', state: this.state }));
      
      server.addEventListener('close', () => {
        this.sessions.delete(server);
      });
      
      return new Response(null, { status: 101, webSocket: client });
    }
  } as typeof DurableObject;
}