export function createShoppingListPrompt(mealPlan: any) {
    return `You are a smart meal planning assistant. 
    Given the following **7-day meal plan**, generate a **shopping list** that consolidates all ingredients.
    
    - Combine duplicate ingredients and sum up their quantities.
    - Convert quantities into standard units (e.g., grams, cups, tbsp, etc.).
    - List items in a structured JSON format.

    **Meal Plan:**
    ${JSON.stringify(mealPlan.plan.week, null, 2)}

    **Expected JSON Response Format:**
    {
      "shopping_list": [
        { "ingredient": "Chicken breast", "quantity": "600g" },
        { "ingredient": "Quinoa", "quantity": "3 cups" },
        { "ingredient": "Almond milk", "quantity": "2 liters" }
      ]
    }
    
    **Return only valid JSON, no explanations.**`;
}

export function createMealPlanPrompt(setup: any) {
    return `You are a meal planning assistant. Generate a **7-day structured meal plan** in JSON format based on:

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
}