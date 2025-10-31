import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth", "routes/auth.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("projects", "routes/projects.tsx"),
  route("mfg/tasks", "routes/mfg.tasks.tsx"),
] satisfies RouteConfig;
