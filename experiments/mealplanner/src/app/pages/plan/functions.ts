"use server";

import { db } from "@/db";
import { Context } from "@/worker";
export async function getMealPlan(userId: string) {
  const mealPlan = await db.mealPlan.findUnique({
    where: { userId }
  });
  return mealPlan;
}

export async function createMealPlan(apiKey: string, userId: string) {
  const setup = await db.setup.findUnique({
    where: { userId }
  });
  const prompt = `You are a meal planning assistant. Generate a **7-day structured meal plan** in JSON format based on:

- Age: ${setup?.age}
- Gender: ${setup?.gender}
- Weight: ${setup?.weight} kg
- Height: ${setup?.height} cm
- Activity Level: ${setup?.activityLevel}
- Dietary Preferences: ${setup?.dietaryPreferences || "None"}
- Health Issues: ${setup?.healthIssues || "None"}

**Return ONLY valid JSON.** No extra explanations, no comments. If your response is too long, make sure to complete all 7 days.

Ensure meals include:
- Breakfast, Lunch, Dinner, Snacks
- Each meal has: 'meal', 'ingredients', 'calories'
- Snacks are an array
- A 'total_calories' field per day

The expected JSON format:
{
  "week": [
    {
      "day": "Monday",
      "meals": {
        "breakfast": { "meal": "Meal name", "ingredients": ["Ingredient 1", "Ingredient 2"], "calories": 0 },
        "lunch": { "meal": "Meal name", "ingredients": ["Ingredient 1", "Ingredient 2"], "calories": 0 },
        "dinner": { "meal": "Meal name", "ingredients": ["Ingredient 1", "Ingredient 2"], "calories": 0 },
        "snacks": [{ "meal": "Snack name", "ingredients": ["Ingredient 1", "Ingredient 2"], "calories": 0 }]
      },
      "total_calories": 0
    }
  ]
}

Again, **return ONLY valid JSON.**`;


  // const response = await openai.chat.completions.create({
  //   model: "gpt-4",
  //   messages: [{ role: "user", content: prompt }],
  //   max_tokens: 500,
  // });
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error("ChatGPT returned no response");
  }

  // Validate JSON format
  let mealPlan;
  try {
    mealPlan = JSON.parse(responseText);
  } catch (error) {
    console.error("🔻 JSON Parse Error:", error, "Response Text:", responseText);
    throw new Error("ChatGPT returned invalid JSON");
  }

  // Save meal plan to the database
  const savedMealPlan = await db.mealPlan.create({
    data: {
      userId,
      plan: mealPlan, // Storing as JSON
    },
  });
  return savedMealPlan;
}