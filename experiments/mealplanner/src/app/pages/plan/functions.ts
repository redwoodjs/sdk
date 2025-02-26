"use server";

import { db } from "@/db";
import { createMealPlanPrompt, createShoppingListPrompt } from "./prompts";

export async function getUserData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      mealplan: true,
      setup: true,
      // shoppinglist: true
    }
  });
  return user;
}

export async function getMealPlan(userId: string) {
  const mealPlan = await db.mealPlan.findUnique({
    where: { userId }
  });
  return mealPlan;
}

export async function getShoppingList(userId: string) {
  const mealPlan = await db.mealPlan.findUnique({
    where: { userId }
  });
  return mealPlan;
}

export async function createShoppingList(apiKey: string, mealPlan: any, userId: string, dev: boolean) {
  const prompt = createShoppingListPrompt(mealPlan);

  const example_list = {
    "shopping_list": {
      "Proteins": [
        { "ingredient": "Chicken breast", "quantity": "600g" },
        { "ingredient": "Eggs", "quantity": "12" }
      ],
      "Vegetables": [
        { "ingredient": "Spinach", "quantity": "4 cups" },
        { "ingredient": "Tomatoes", "quantity": "5" }
      ],
      "Fruits": [
        { "ingredient": "Bananas", "quantity": "6" },
        { "ingredient": "Apples", "quantity": "4" }
      ],
      "Dairy": [
        { "ingredient": "Greek Yogurt", "quantity": "2 cups" }
      ],
      "Grains": [
        { "ingredient": "Quinoa", "quantity": "3 cups" },
        { "ingredient": "Oats", "quantity": "2 cups" }
      ],
      "Condiments & Oils": [
        { "ingredient": "Olive oil", "quantity": "200ml" }
      ]
    }
  }
  let shoppingList;

  // for dev lets return the exapmple lsit and not use the api
  if (!dev) {
    
  

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content?.trim();
  console.log(responseText);

    if (!responseText) {
      throw new Error("Invalid response from ChatGPT");
    }

    
    try {
      shoppingList = JSON.parse(responseText);
    } catch (error) {
      console.error("🔻 JSON Parse Error:", error, "Response Text:", responseText);
      throw new Error("ChatGPT returned invalid JSON");
    }

    if (!shoppingList.shopping_list) {
      throw new Error("Invalid shopping list format returned.");
    }
  } else {
    shoppingList = example_list;
    // Save shopping list to database
    // if there is already a shopping list, update it   
    const existingShoppingList = await db.shoppingList.findUnique({
      where: { userId }
    });
    if (existingShoppingList) {
      const updatedShoppingList = await db.shoppingList.update({
        where: { id: existingShoppingList.id },
        data: { items: shoppingList.shopping_list },
      });
      return updatedShoppingList;
    }
    
  }
  const savedShoppingList = await db.shoppingList.create({
    data: {
      userId,
      mealPlanId: mealPlan.id,
      items: shoppingList.shopping_list,
    },
  });
  return shoppingList;
}

export async function createMealPlan(apiKey: string, userId: string) {
  const setup = await db.setup.findUnique({
    where: { userId }
  });
  const prompt = createMealPlanPrompt(setup);

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