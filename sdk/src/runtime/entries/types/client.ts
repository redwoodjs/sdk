import "./shared";

export interface ClientNavigationOptions {
  onNavigate?: () => Promise<void> | void;
  scrollToTop?: boolean;
  scrollBehavior?: "auto" | "smooth" | "instant";
}
