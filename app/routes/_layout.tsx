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
import { Home, RefreshCw } from "lucide-react";

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

export default function Layout() {
  const location = useLocation();
  const revalidator = useRevalidator();
  const breadcrumbs = getBreadcrumbs(location.pathname);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Route content */}
      <Outlet />
    </div>
  );
}

