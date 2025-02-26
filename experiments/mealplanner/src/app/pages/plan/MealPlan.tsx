"use client";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Context } from "@/worker";
import { getUserData } from "./functions";
import { Layout } from "@/app/Layout";
import { Loader2, RefreshCw, ShoppingBag, Download, Share2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

export function MealPlanPage({ ctx }: { ctx: Context }) {
  const [mealPlan, setMealPlan] = useState(null);
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatingList, setGeneratingList] = useState(false);
  const [error, setError] = useState(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [activeDay, setActiveDay] = useState("0");

  useEffect(() => {
    if (ctx?.user && !fetchAttempted) {
      fetchUserData();
      setFetchAttempted(true);
    }
  }, [ctx, fetchAttempted]);
  

  
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await getUserData(ctx?.user?.id);
      if (res && res.mealplan) {
        setMealPlan(res.mealplan.plan);
        if (res.mealplan.shoppingList) {
          setShoppingList(res.mealplan.shoppingList.items);
        }
      }
      
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
      if (data && data.plan) {
        setMealPlan(data.plan);
      }
    } catch (error) {
      console.error("Error generating meal plan:", error);
    }
    setLoading(false);
  };

  const generateShoppingList = async () => {
    if (!mealPlan) return;
    
    setGeneratingList(true);
    try {
      const res = await fetch("/api/createShoppingList", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data && data.items) {
        setShoppingList(data.items);
      }
    } catch (error) {
      console.error("Error generating shopping list:", error);
    }
    setGeneratingList(false);
  };

  const downloadShoppingList = () => {
    if (!shoppingList) return;
    
    // Format the shopping list as text
    let listText = "SHOPPING LIST\n\n";
    
    if (shoppingList.shopping_list) {
      // Handle the structured shopping list with categories
      const categorizedList = shoppingList.shopping_list;
      
      Object.entries(categorizedList).forEach(([category, items]) => {
        listText += `${category.toUpperCase()}\n`;
        listText += "----------------------------------------\n";
        
        if (Array.isArray(items)) {
          items.forEach(item => {
            listText += `• ${item.ingredient}: ${item.quantity}\n`;
          });
        }
        
        listText += "\n";
      });
    } else if (Array.isArray(shoppingList)) {
      // Handle case where shoppingList is a simple array
      shoppingList.forEach(item => {
        const itemName = item.ingredient || item.name;
        listText += `• ${itemName}: ${item.quantity}\n`;
      });
    } else if (typeof shoppingList === 'object') {
      // Handle other object structures
      Object.entries(shoppingList).forEach(([category, items]) => {
        if (category !== 'shopping_list') {
          listText += `\n${category.toUpperCase()}:\n`;
          if (Array.isArray(items)) {
            items.forEach(item => {
              const itemName = item.ingredient || item.name;
              listText += `• ${itemName}: ${item.quantity}\n`;
            });
          }
        }
      });
    }
    
    // Create a blob and download link
    const blob = new Blob([listText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareToWhatsApp = () => {
    if (!shoppingList) return;
    
    // Format the shopping list as text
    let listText = "🛒 *SHOPPING LIST*\n\n";
    
    if (shoppingList.shopping_list) {
      // Handle the structured shopping list with categories
      const categorizedList = shoppingList.shopping_list;
      
      Object.entries(categorizedList).forEach(([category, items]) => {
        listText += `*${category.toUpperCase()}*\n`;
        
        if (Array.isArray(items)) {
          items.forEach(item => {
            listText += `• ${item.ingredient}: ${item.quantity}\n`;
          });
        }
        
        listText += "\n";
      });
    } else if (Array.isArray(shoppingList)) {
      // Handle case where shoppingList is a simple array
      shoppingList.forEach(item => {
        const itemName = item.ingredient || item.name;
        listText += `• ${itemName}: ${item.quantity}\n`;
      });
    } else if (typeof shoppingList === 'object') {
      // Handle other object structures
      Object.entries(shoppingList).forEach(([category, items]) => {
        if (category !== 'shopping_list') {
          listText += `\n*${category.toUpperCase()}*:\n`;
          if (Array.isArray(items)) {
            items.forEach(item => {
              const itemName = item.ingredient || item.name;
              listText += `• ${itemName}: ${item.quantity}\n`;
            });
          }
        }
      });
    }
    
    // Encode the text for URL
    const encodedText = encodeURIComponent(listText);
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    
    // Open in a new tab
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Layout ctx={ctx}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your 7-Day Meal Plan</h1>
          <div className="flex gap-3">
            {mealPlan && (
              <>
                {!shoppingList ? (
                  <Button 
                    onClick={generateShoppingList} 
                    variant="outline"
                    className="border-black text-black hover:bg-gray-100"
                    disabled={generatingList}
                  >
                    {generatingList ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Generate Shopping List
                      </span>
                    )}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      onClick={downloadShoppingList} 
                      variant="outline"
                      className="border-black text-black hover:bg-gray-100"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Download List
                      </span>
                    </Button>
                    <Button 
                      onClick={shareToWhatsApp} 
                      variant="outline"
                      className="border-black text-black hover:bg-gray-100"
                    >
                      <span className="flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        Share via WhatsApp
                      </span>
                    </Button>
                  </div>
                )}
              </>
            )}
            <Button 
              onClick={generateMealPlan} 
              variant="outline"
              className="border-black text-black hover:bg-gray-100"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {mealPlan ? "Regenerate Plan" : "Generate Plan"}
                </span>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading && !mealPlan && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && !mealPlan && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No meal plan available yet.</p>
            <p className="text-gray-500 text-sm">Generate a personalized 7-day meal plan based on your preferences and dietary requirements.</p>
          </div>
        )}

        {mealPlan && mealPlan.week && mealPlan.week.length === 7 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <Tabs defaultValue="0" value={activeDay} onValueChange={setActiveDay}>
              <TabsList className="w-full border-b border-gray-200 bg-gray-50 p-0 h-auto">
                <div className="flex overflow-x-auto">
                  {mealPlan.week.map((day, index) => (
                    <TabsTrigger 
                      key={index}
                      value={index.toString()}
                      className="flex-1 py-3 px-4 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none"
                    >
                      {day.day}
                    </TabsTrigger>
                  ))}
                </div>
              </TabsList>

              {mealPlan.week.map((day, index) => (
                <TabsContent key={index} value={index.toString()} className="p-0 m-0">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">{day.day}'s Meals</h2>
                      <p className="text-sm font-medium bg-black text-white px-3 py-1 rounded">
                        {day.total_calories} calories
                      </p>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Meal</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Ingredients</TableHead>
                          <TableHead>Portion Size</TableHead>
                          <TableHead className="text-right">Calories</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">🥞</span> Breakfast
                            </span>
                          </TableCell>
                          <TableCell>{day.meals.breakfast.meal}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {day.meals.breakfast.ingredients.join(", ")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {day.meals.breakfast.portion_size || "Standard serving"}
                          </TableCell>
                          <TableCell className="text-right">{day.meals.breakfast.calories}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">🍛</span> Lunch
                            </span>
                          </TableCell>
                          <TableCell>{day.meals.lunch.meal}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {day.meals.lunch.ingredients.join(", ")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {day.meals.lunch.portion_size || "Standard serving"}
                          </TableCell>
                          <TableCell className="text-right">{day.meals.lunch.calories}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">🍽️</span> Dinner
                            </span>
                          </TableCell>
                          <TableCell>{day.meals.dinner.meal}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {day.meals.dinner.ingredients.join(", ")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {day.meals.dinner.portion_size || "Standard serving"}
                          </TableCell>
                          <TableCell className="text-right">{day.meals.dinner.calories}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">🍎</span> Snacks
                            </span>
                          </TableCell>
                          <TableCell>{day.meals.snacks.map(snack => snack.meal).join(", ")}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {day.meals.snacks.flatMap(snack => snack.ingredients).join(", ")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {day.meals.snacks.map(snack => snack.portion_size || "Standard serving").join("; ")}
                          </TableCell>
                          <TableCell className="text-right">
                            {day.meals.snacks.reduce((total, snack) => total + snack.calories, 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </div>
    </Layout>
  );
}
