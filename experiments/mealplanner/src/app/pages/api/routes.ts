import { route, RouteDefinition } from '@redwoodjs/sdk/router';
import { Context } from '@/worker';
import { createMealPlan } from '../plan/functions';

export const apiRoutes: RouteDefinition<Context>[] = [
  route('/createMealPlan', async ({ ctx, env }) => {
    const apiKey = env.OPENAI_API_KEY;
    const userId = ctx.user?.id;
    const mealPlan = await createMealPlan(apiKey, userId);
    return new Response(JSON.stringify(mealPlan), { status: 200 });
  }),
]
