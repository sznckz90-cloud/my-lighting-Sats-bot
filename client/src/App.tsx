import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { initializeTelegramWebApp } from "@/lib/telegram";

// Pages
import Home from "@/pages/home";
import Friends from "@/pages/friends";
import Wallet from "@/pages/wallet";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

// Navigation component
function BottomNavigation() {
  const [location] = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-card border-t border-border py-3 z-20">
      <div className="flex justify-around">
        <Link 
          href="/" 
          className={`nav-item ${location === '/' ? 'active' : ''}`}
          data-testid="nav-home"
        >
          <i className="fas fa-home text-lg"></i>
          <span className="text-xs font-medium">Home</span>
        </Link>
        <Link 
          href="/friends" 
          className={`nav-item ${location === '/friends' ? 'active' : ''}`}
          data-testid="nav-friends"
        >
          <i className="fas fa-users text-lg"></i>
          <span className="text-xs font-medium">Friends</span>
        </Link>
        <Link 
          href="/wallet" 
          className={`nav-item ${location === '/wallet' ? 'active' : ''}`}
          data-testid="nav-wallet"
        >
          <i className="fas fa-wallet text-lg"></i>
          <span className="text-xs font-medium">Wallet</span>
        </Link>
      </div>
    </nav>
  );
}

// Header component
function Header() {
  const [location] = useLocation();
  
  return (
    <header className="bg-card/80 border-b border-border p-4 sticky top-0 z-10 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white">
            <span className="text-lg font-bold rotate-180">▲</span>
          </div>
          <div>
            <div className="font-semibold text-white" data-testid="text-app-name">LightingSats</div>
            <div className="text-xs text-muted-foreground" data-testid="text-app-tagline">Watch & Earn</div>
          </div>
        </div>
        {/* Admin Link - Only visible in development or for admin */}
        {location !== '/admin' && (
          <Link 
            href="/admin" 
            className="text-xs text-muted-foreground hover:text-white transition-colors"
            data-testid="link-admin"
          >
            <i className="fas fa-shield-alt mr-1"></i>
            Admin
          </Link>
        )}
      </div>
    </header>
  );
}

function Router() {
  return (
    <div className="container-mobile">
      <Header />
      
      <div className="p-6 pb-20">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/friends" component={Friends} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </div>

      <BottomNavigation />
    </div>
  );
}

function App() {
  useEffect(() => {
    // Initialize Telegram WebApp
    initializeTelegramWebApp();
    
    // Force dark theme
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground font-inter">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
