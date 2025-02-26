"use client";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Context } from "@/worker";
import { getMealPlan } from "./functions";

export function MealPlanPage({ ctx }: { ctx: Context }) {
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);


  useEffect(() => {
    if (ctx?.user && !fetchAttempted) {
      fetchMealPlan();
      setFetchAttempted(true);
    }
  }, [ctx, fetchAttempted]);

  const fetchMealPlan = async () => {
    setLoading(true);
    try {
      const res = await getMealPlan(ctx?.user?.id);
      setMealPlan(res.plan);
    } catch (error) {
      console.error("Error fetching meal plan:", error);
    }
    setLoading(false);
  };

  const generateMealPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/createMealPlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setMealPlan(data.plan);
    } catch (error) {
      console.error("Error generating meal plan:", error);
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-4xl p-6 bg-white shadow-lg rounded-xl">
        <h2 className="text-2xl font-bold text-center mb-4">Your 7-Day Meal Plan</h2>

        {loading && <p className="text-center text-blue-500">Loading...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}

        {mealPlan && mealPlan.week.length === 7 ? (
          <CardContent>
            {mealPlan.week.map((dayPlan, index) => (
              <div key={index} className="mb-6 p-4 border rounded-lg shadow-sm bg-gray-50">
                <h3 className="text-lg font-semibold text-blue-600">{dayPlan.day}</h3>

                <div className="mt-2">
                  <p><strong>🥞 Breakfast:</strong> {dayPlan.meals.breakfast.meal}</p>
                  <p className="text-sm text-gray-600">
                    Ingredients: {dayPlan.meals.breakfast.ingredients.join(", ")}
                  </p>
                  <p className="text-sm">Calories: {dayPlan.meals.breakfast.calories}</p>
                </div>

                <div className="mt-2">
                  <p><strong>🍛 Lunch:</strong> {dayPlan.meals.lunch.meal}</p>
                  <p className="text-sm text-gray-600">
                    Ingredients: {dayPlan.meals.lunch.ingredients.join(", ")}
                  </p>
                  <p className="text-sm">Calories: {dayPlan.meals.lunch.calories}</p>
                </div>

                <div className="mt-2">
                  <p><strong>🍽️ Dinner:</strong> {dayPlan.meals.dinner.meal}</p>
                  <p className="text-sm text-gray-600">
                    Ingredients: {dayPlan.meals.dinner.ingredients.join(", ")}
                  </p>
                  <p className="text-sm">Calories: {dayPlan.meals.dinner.calories}</p>
                </div>

                <div className="mt-2">
                  <p><strong>🍎 Snacks:</strong> {dayPlan.meals.snacks.map(snack => snack.meal).join(", ")}</p>
                  <p className="text-sm text-gray-600">
                    Ingredients: {dayPlan.meals.snacks.flatMap(snack => snack.ingredients).join(", ")}
                  </p>
                  <p className="text-sm">Calories: {dayPlan.meals.snacks.reduce((total, snack) => total + snack.calories, 0)}</p>
                </div>

                <p className="text-md font-bold mt-4 text-green-600">Total Calories: {dayPlan.total_calories}</p>
              </div>
            ))}
          </CardContent>
        ) : (
          <p className="text-center text-gray-600">No meal plan available. Generate one below.</p>
        )}

        <div className="flex justify-center mt-4">
          <Button onClick={generateMealPlan} className="bg-blue-500 text-white px-6 py-2">
            {mealPlan ? "Regenerate Meal Plan" : "Generate Meal Plan"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
