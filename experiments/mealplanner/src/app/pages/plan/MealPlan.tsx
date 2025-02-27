"use client";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Context } from "@/worker";
import { getUserData } from "./functions";
import { Layout } from "@/app/Layout";
import { Loader2, RefreshCw, ShoppingBag, Download, Share2, Lock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Alert, AlertDescription } from "@/app/components/ui/alert";

// Define types for our data structures
type MealPlanType = {
  week: {
    day: string;
    total_calories: number;
    meals: {
      breakfast: {
        meal: string;
        ingredients: string[];
        calories: number;
        portion_size?: string;
      };
      lunch: {
        meal: string;
        ingredients: string[];
        calories: number;
        portion_size?: string;
      };
      dinner: {
        meal: string;
        ingredients: string[];
        calories: number;
        portion_size?: string;
      };
      snacks: Array<{
        meal: string;
        ingredients: string[];
        calories: number;
        portion_size?: string;
      }>;
    };
  }[];
  summary?: {
    description: string;
  }; // Optional summary with description
};

type ShoppingListItem = {
  ingredient: string;
  name?: string;
  quantity: string;
};

type ShoppingListType = {
  shopping_list?: Record<string, ShoppingListItem[]>;
} | ShoppingListItem[];

export function MealPlanPage({ ctx }: { ctx: Context }) {
  const [mealPlan, setMealPlan] = useState<MealPlanType | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListType | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingList, setGeneratingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [activeDay, setActiveDay] = useState("0");
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [canGeneratePlan, setCanGeneratePlan] = useState(false);
  // Debug flag to override restrictions
  const [debugMode, setDebugMode] = useState(ctx.debugMode);

  // Helper function to set the active day to the current day of the week
  const setActiveDayToCurrent = () => {
    const today = new Date();
    // Get current day index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const currentDayIndex = today.getDay();
    // Convert to our index (0 = Monday, 1 = Tuesday, ..., 6 = Sunday)
    // If currentDayIndex is 0 (Sunday), we want 6, otherwise subtract 1
    const adjustedDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
    // Set the active day to the current day's index
    setActiveDay(adjustedDayIndex.toString());
  };

  useEffect(() => {
    if (ctx?.user && !fetchAttempted) {
      fetchUserData();
      setFetchAttempted(true);
    }
    
    // Check if today is Monday or if user is premium
    const today = new Date();
    const isMonday = today.getDay() === 1; // 0 is Sunday, 1 is Monday
    const isPremiumUser = ctx?.user ? (ctx.user as any).isPremium || false : false; // Safe access with type assertion
    
    // Allow first-time users (with no meal plan) to generate a plan regardless of the day
    const isFirstTimeUser = !mealPlan;
    
    setCanGeneratePlan(isMonday || isPremiumUser || isFirstTimeUser);
  }, [ctx, fetchAttempted, mealPlan]);
  
  const fetchUserData = async () => {
    setLoading(true);
    setLoadingMessage("Loading your meal plan data...");
    try {
      const res = await getUserData(ctx?.user?.id || "");
      console.log(res);
      if (res && res.mealplan) {
        setMealPlan(res.mealplan.plan as unknown as MealPlanType);
        if (res.mealplan.shoppingList) {
          setShoppingList(res.mealplan.shoppingList.items as unknown as ShoppingListType);
        }
        // Set active day to current day when meal plan is loaded
        setActiveDayToCurrent();
      }
    } catch (error) {
      console.error("Error fetching meal plan:", error);
      setError("Failed to load your meal plan. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  const generateMealPlan = async () => {
    // Check if user can generate a plan (unless in debug mode)
    if (!canGeneratePlan && !debugMode) {
      setError("Free accounts can only regenerate meal plans on Mondays. Upgrade to premium for unlimited access!");
      return;
    }
    
    setLoading(true);
    setLoadingMessage("Generating your personalized meal plan... This may take up to 30 seconds.");
    try {
      const res = await fetch("/api/createMealPlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json() as { plan?: MealPlanType };
      if (data && data.plan) {
        setMealPlan(data.plan);
        // Reset shopping list when generating a new meal plan
        setShoppingList(null);
        // Set active day to current day when new meal plan is generated
        setActiveDayToCurrent();
      }
    } catch (error) {
      console.error("Error generating meal plan:", error);
      setError("Failed to generate meal plan. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  const generateShoppingList = async () => {
    if (!mealPlan) return;
    
    setGeneratingList(true);
    setLoadingMessage("Generating your shopping list... This may take a few moments.");
    try {
      const res = await fetch("/api/createShoppingList", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json() as { items?: ShoppingListType };
      if (data && data.items) {
        setShoppingList(data.items);
      }
    } catch (error) {
      console.error("Error generating shopping list:", error);
      setError("Failed to generate shopping list. Please try again.");
    } finally {
      setGeneratingList(false);
      setLoadingMessage(null);
    }
  };

  const downloadShoppingList = () => {
    if (!shoppingList) return;
    
    // Format the shopping list as text
    let listText = "SHOPPING LIST\n\n";
    
    if (shoppingList && 'shopping_list' in shoppingList && shoppingList.shopping_list) {
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
        const itemName = item.ingredient || item.name || '';
        listText += `• ${itemName}: ${item.quantity}\n`;
      });
    } else if (typeof shoppingList === 'object') {
      // Handle other object structures
      Object.entries(shoppingList).forEach(([category, items]) => {
        if (category !== 'shopping_list') {
          listText += `\n${category.toUpperCase()}:\n`;
          if (Array.isArray(items)) {
            (items as any[]).forEach(item => {
              const itemName = item.ingredient || item.name || '';
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
    
    if (shoppingList && 'shopping_list' in shoppingList && shoppingList.shopping_list) {
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
        const itemName = item.ingredient || item.name || '';
        listText += `• ${itemName}: ${item.quantity}\n`;
      });
    } else if (typeof shoppingList === 'object') {
      // Handle other object structures
      Object.entries(shoppingList).forEach(([category, items]) => {
        if (category !== 'shopping_list') {
          listText += `\n*${category.toUpperCase()}*:\n`;
          if (Array.isArray(items)) {
            (items as any[]).forEach(item => {
              const itemName = item.ingredient || item.name || '';
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
        {/* Responsive header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold">Your 7-Day Meal Plan</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Debug toggle button */}
            {debugMode && (
              <Button
                onClick={() => setDebugMode(!debugMode)}
                variant="outline"
              className={`border-gray-300 text-xs sm:text-sm flex-none ${
                debugMode ? "bg-red-100 border-red-500 text-red-500" : "text-gray-500"
              }`}
            >
              <span className="flex items-center gap-1">
                {debugMode ? "Debug: ON" : "Debug: OFF"}
              </span>
            </Button>
            )}
            
            {mealPlan && (
              <>
                {!shoppingList ? (
                  <Button 
                    onClick={generateShoppingList} 
                    variant="outline"
                    className="border-black text-black hover:bg-gray-100 flex-1 sm:flex-none"
                    disabled={generatingList}
                  >
                    {generatingList ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="sm:inline hidden">Generating...</span>
                        <span className="sm:hidden inline">Loading...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="sm:inline hidden">Generate Shopping List</span>
                        <span className="sm:hidden inline">Shopping List</span>
                      </span>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button 
                      onClick={downloadShoppingList} 
                      variant="outline"
                      className="border-black text-black hover:bg-gray-100 flex-1 sm:flex-none"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        <span className="sm:inline hidden">Download shopping list</span>
                        <span className="sm:hidden inline">Download</span>
                      </span>
                    </Button>
                    <Button 
                      onClick={shareToWhatsApp} 
                      variant="outline"
                      className="border-black text-black hover:bg-gray-100 flex-1 sm:flex-none"
                    >
                      <span className="flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        <span className="sm:inline hidden">Share via WhatsApp</span>
                        <span className="sm:hidden inline">Share</span>
                      </span>
                    </Button>
                  </div>
                )}
              </>
            )}
            <Button 
              onClick={generateMealPlan} 
              variant="outline"
              className="border-black text-black hover:bg-gray-100 flex-1 sm:flex-none"
              disabled={loading || (!canGeneratePlan && !debugMode)}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </span>
              ) : !canGeneratePlan && !debugMode ? (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="sm:inline hidden">Available on Mondays</span>
                  <span className="sm:hidden inline">Mondays Only</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>{mealPlan ? "Regenerate Plan" : "Generate Plan"}</span>
                </span>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!canGeneratePlan && !debugMode && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertDescription className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Free accounts can only regenerate meal plans on Mondays. Upgrade to premium for unlimited access!
            </AlertDescription>
          </Alert>
        )}

        {debugMode && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Debug mode enabled. You can generate meal plans regardless of restrictions.
            </AlertDescription>
          </Alert>
        )}

        {!mealPlan && canGeneratePlan && !loading && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertDescription className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              As a new user, you can generate your first meal plan now! After that, free accounts can only regenerate plans on Mondays.
            </AlertDescription>
          </Alert>
        )}

        {loadingMessage && (
          <div className="bg-black text-white p-4 rounded-md mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>{loadingMessage}</p>
            </div>
          </div>
        )}

        {loading && !mealPlan && !loadingMessage && (
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

        {mealPlan && mealPlan.week && mealPlan.week.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <Tabs defaultValue="0" value={activeDay} onValueChange={setActiveDay}>
              <TabsList className="w-full border-b border-gray-200 bg-gray-50 p-0 h-auto">
                <div className="flex overflow-x-auto">
                  {mealPlan.week.map((day, index) => (
                    <TabsTrigger 
                      key={index}
                      value={index.toString()}
                      className="flex-1 py-3 px-2 sm:px-4 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:shadow-none rounded-none text-xs sm:text-sm"
                    >
                      {day.day}
                    </TabsTrigger>
                  ))}
                </div>
              </TabsList>

              {mealPlan.week.map((day, index) => (
                <TabsContent key={index} value={index.toString()} className="p-0 m-0">
                  <div className="p-3 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg sm:text-xl font-semibold">{day.day}'s Meals</h2>
                      <p className="text-xs sm:text-sm font-medium bg-black text-white px-2 sm:px-3 py-1 rounded">
                        {day.total_calories} calories
                      </p>
                    </div>

                    {/* Desktop view - standard table */}
                    <div className="hidden sm:block">
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

                    {/* Mobile view - card-based layout */}
                    <div className="sm:hidden space-y-4">
                      {/* Breakfast Card */}
                      <div className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="text-lg">🥞</span> Breakfast
                          </span>
                          <span className="text-xs font-medium bg-black text-white px-2 py-1 rounded">
                            {day.meals.breakfast.calories} cal
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-1">{day.meals.breakfast.meal}</h3>
                        <p className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Ingredients:</span> {day.meals.breakfast.ingredients.join(", ")}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Portion:</span> {day.meals.breakfast.portion_size || "Standard serving"}
                        </p>
                      </div>

                      {/* Lunch Card */}
                      <div className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="text-lg">🍛</span> Lunch
                          </span>
                          <span className="text-xs font-medium bg-black text-white px-2 py-1 rounded">
                            {day.meals.lunch.calories} cal
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-1">{day.meals.lunch.meal}</h3>
                        <p className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Ingredients:</span> {day.meals.lunch.ingredients.join(", ")}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Portion:</span> {day.meals.lunch.portion_size || "Standard serving"}
                        </p>
                      </div>

                      {/* Dinner Card */}
                      <div className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="text-lg">🍽️</span> Dinner
                          </span>
                          <span className="text-xs font-medium bg-black text-white px-2 py-1 rounded">
                            {day.meals.dinner.calories} cal
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-1">{day.meals.dinner.meal}</h3>
                        <p className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Ingredients:</span> {day.meals.dinner.ingredients.join(", ")}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Portion:</span> {day.meals.dinner.portion_size || "Standard serving"}
                        </p>
                      </div>

                      {/* Snacks Card */}
                      <div className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="text-lg">🍎</span> Snacks
                          </span>
                          <span className="text-xs font-medium bg-black text-white px-2 py-1 rounded">
                            {day.meals.snacks.reduce((total, snack) => total + snack.calories, 0)} cal
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-1">{day.meals.snacks.map(snack => snack.meal).join(", ")}</h3>
                        <p className="text-xs text-gray-600 mb-1">
                          <span className="font-medium">Ingredients:</span> {day.meals.snacks.flatMap(snack => snack.ingredients).join(", ")}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Portion:</span> {day.meals.snacks.map(snack => snack.portion_size || "Standard serving").join("; ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            {mealPlan.summary && (  
              <div className="p-3 sm:p-6">
                <p className="text-sm text-gray-600">{mealPlan.summary.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
