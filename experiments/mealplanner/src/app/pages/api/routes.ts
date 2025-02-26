import { route, RouteDefinition } from '@redwoodjs/sdk/router';
import { Context } from '@/worker';
import { createMealPlan, createShoppingList, getMealPlan } from '../plan/functions';

export const apiRoutes: RouteDefinition<Context>[] = [
  route('/createMealPlan', async ({ ctx, env }) => {
    const apiKey = env.OPENAI_API_KEY;
    const userId = ctx.user?.id;
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    const mealPlan = await createMealPlan(apiKey, userId);
    return new Response(JSON.stringify(mealPlan), { status: 200 });
  }),
  route('/createShoppingList', async ({ ctx, env }) => {
    const apiKey = env.OPENAI_API_KEY;
    const userId = ctx.user?.id;
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    const mealPlan = await getMealPlan(userId); 
    if (!mealPlan) {
      return new Response('Meal plan not found', { status: 404 });
    }
    const dev = env.ENV === "development";
    const shoppingList = await createShoppingList(apiKey, mealPlan, userId, dev);
    return new Response(JSON.stringify(shoppingList), { status: 200 });
  }),   
]
