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

Each meal should include:
- **Meal Name** (e.g., "Grilled Chicken with Quinoa")
- **Ingredients** (list each ingredient used)
- **Calories** (calculated total per meal)
- **Portion Size** (clearly indicate portion amounts, e.g., "150g chicken, 1 cup quinoa, 1/2 avocado")

Expected JSON format:
{
  "week": [
    {
      "day": "Monday",
      "meals": {
        "breakfast": { 
          "meal": "Oatmeal with Bananas",
          "ingredients": ["Oats", "Banana", "Almond Milk"],
          "portion_size": "1/2 cup oats, 1 banana, 1 cup almond milk",
          "calories": 350
        },
        "lunch": { 
          "meal": "Grilled Chicken Salad",
          "ingredients": ["Chicken", "Lettuce", "Tomato", "Avocado", "Olive Oil"],
          "portion_size": "150g chicken, 2 cups lettuce, 1/2 avocado",
          "calories": 500
        },
        "dinner": { 
          "meal": "Salmon with Quinoa",
          "ingredients": ["Salmon", "Quinoa", "Spinach", "Lemon Juice"],
          "portion_size": "120g salmon, 1/2 cup quinoa, 1 cup spinach",
          "calories": 600
        },
        "snacks": [
          {
            "meal": "Greek Yogurt with Nuts",
            "ingredients": ["Greek Yogurt", "Almonds", "Honey"],
            "portion_size": "1 cup yogurt, 10 almonds, 1 tsp honey",
            "calories": 250
          }
        ]
      },
      "total_calories": 1700
    }
  ]
}

**Return ONLY valid JSON, no explanations.**`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
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
  // if there is already a meal plan, update it 
  const existingMealPlan = await db.mealPlan.findUnique({
    where: { userId },
  });
  if (existingMealPlan) {
    const updatedMealPlan = await db.mealPlan.update({
      where: { id: existingMealPlan.id },
      data: { plan: mealPlan },
    });
    return updatedMealPlan;
  }
  const savedMealPlan = await db.mealPlan.create({
    data: { userId, plan: mealPlan }, // Storing as JSON
  });
  return savedMealPlan;
}