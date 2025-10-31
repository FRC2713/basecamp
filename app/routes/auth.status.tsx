import type { Route } from "./+types/auth.status";
import { json } from "react-router";
import { isOnshapeAuthenticated, isBasecampAuthenticated } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  const basecampAuthenticated = await isBasecampAuthenticated(request);

  return json({
    onshape: {
      authenticated: onshapeAuthenticated,
    },
    basecamp: {
      authenticated: basecampAuthenticated,
    },
  });
}

export default function AuthStatus({ loaderData }: Route.ComponentProps) {
  const { onshape, basecamp } = loaderData;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Authentication Status</h1>
        
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-2">Onshape</h2>
            <p className="text-sm text-muted-foreground">
              {onshape.authenticated ? (
                <span className="text-green-600">✓ Authenticated</span>
              ) : (
                <span className="text-red-600">✗ Not authenticated</span>
              )}
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold mb-2">Basecamp</h2>
            <p className="text-sm text-muted-foreground">
              {basecamp.authenticated ? (
                <span className="text-green-600">✓ Authenticated</span>
              ) : (
                <span className="text-red-600">✗ Not authenticated</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

