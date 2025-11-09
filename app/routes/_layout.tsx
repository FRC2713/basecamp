import type { Route } from "./+types/_layout";
import { Outlet, useLocation, Link, useRevalidator } from "react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Home, RefreshCw, User, LogIn, LogOut } from "lucide-react";
import { isBasecampAuthenticated, isOnshapeAuthenticated } from "~/lib/session";

function getBreadcrumbs(pathname: string) {
  const paths = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ label: string; href: string }> = [];

  // Route label mapping for better display names
  const routeLabels: Record<string, string> = {
    mfg: "MFG",
    tasks: "Tasks",
    projects: "Projects",
  };

  // If we're at home, just return home breadcrumb
  if (pathname === "/") {
    return [{ label: "Home", href: "/" }];
  }

  // Always start with Home
  breadcrumbs.push({ label: "Home", href: "/" });

  // Build breadcrumbs from path segments
  let currentPath = "";
  paths.forEach((segment) => {
    currentPath += `/${segment}`;
    
    // Use mapped label if available, otherwise format the segment
    const label = routeLabels[segment] || 
      segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    
    breadcrumbs.push({ label, href: currentPath });
  });

  return breadcrumbs;
}

export async function loader({ request }: Route.LoaderArgs) {
  const basecampAuth = await isBasecampAuthenticated(request);
  const onshapeAuth = await isOnshapeAuthenticated(request);

  return {
    basecampAuth,
    onshapeAuth,
    isAuthenticated: basecampAuth && onshapeAuth,
  };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const revalidator = useRevalidator();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const { isAuthenticated, basecampAuth, onshapeAuth } = loaderData;

  const handleRefresh = () => {
    revalidator.revalidate();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Breadcrumbs */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                const isHome = crumb.label === "Home";
                return (
                  <div key={crumb.href} className="flex items-center">
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>
                          {isHome ? (
                            <span className="flex items-center gap-1.5">
                              <Home className="h-4 w-4" />
                              {crumb.label}
                            </span>
                          ) : (
                            crumb.label
                          )}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>
                            {isHome ? (
                              <span className="flex items-center gap-1.5">
                                <Home className="h-4 w-4" />
                                {crumb.label}
                              </span>
                            ) : (
                              crumb.label
                            )}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-8"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <User className="h-4 w-4" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Authentication</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {isAuthenticated ? (
                  <>
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Basecamp Connected</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Onshape Connected</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/auth/logout" className="flex items-center">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {basecampAuth && (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span>Basecamp Connected</span>
                        </div>
                      </div>
                    )}
                    {onshapeAuth && (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span>Onshape Connected</span>
                        </div>
                      </div>
                    )}
                    {(basecampAuth || onshapeAuth) && <DropdownMenuSeparator />}
                    <DropdownMenuItem asChild>
                      <Link to="/signin" className="flex items-center">
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Sign In</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Route content */}
      <Outlet />
    </div>
  );
}

