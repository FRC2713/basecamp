import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Auth routes (not in layout - no breadcrumbs)
  route("auth", "routes/auth.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  // Layout route wrapping all other routes
  layout("routes/_layout.tsx", [
    index("routes/home.tsx"),
    route("projects", "routes/projects.tsx"),
    route("mfg/tasks", "routes/mfg.tasks.tsx"),
  ]),
] satisfies RouteConfig;
