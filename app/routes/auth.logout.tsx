import type { Route } from "./+types/auth.logout";
import { redirect } from "react-router";
import { getSession, destroySession } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  
  // Destroy session and redirect to home
  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}


