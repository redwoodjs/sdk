import { RequestInfo } from "rwsdk/worker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function Home({ ctx }: RequestInfo) {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">
          shadcn/ui Comprehensive Playground
        </h1>
        <p className="text-lg text-muted-foreground">
          A complete showcase of all shadcn/ui components working with React
          Server Components
        </p>
        <Badge variant="secondary" className="text-sm">
          47 Components • React Server Components • Tailwind CSS
        </Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Component Showcase</CardTitle>
            <CardDescription>
              View all 47 shadcn/ui components in action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/showcase">View All Components</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interactive Forms</CardTitle>
            <CardDescription>
              Test form components with client-side interactivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="/forms">Interactive Forms</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Visualization</CardTitle>
            <CardDescription>
              Charts, tables, and data display components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="/data">Data Components</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Navigation & Layout</CardTitle>
            <CardDescription>
              Menus, breadcrumbs, and layout components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="/navigation">Navigation</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overlays & Dialogs</CardTitle>
            <CardDescription>
              Modals, popovers, and overlay components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="/overlays">Overlays</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced Components</CardTitle>
            <CardDescription>
              Complex components like calendar, command palette
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="/advanced">Advanced</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>
          This playground demonstrates all shadcn/ui components working
          seamlessly with React Server Components
        </p>
        <p>Built with shadcn/ui, Tailwind CSS, and RedwoodSDK</p>
      </div>
    </div>
  );
}
