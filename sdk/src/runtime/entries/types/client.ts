import "./shared";

export interface ClientNavigationOptions {
  onNavigate?: () => void;
  scrollToTop?: boolean;
  scrollBehavior?: "auto" | "smooth" | "instant";
}
