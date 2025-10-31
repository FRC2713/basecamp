# Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```env
BASECAMP_CLIENT_ID=940e6cb90c30464ef29fd42877da9f771edf26f8
BASECAMP_CLIENT_SECRET=933eabc064e25cb3d76f6f74c7a75a355e5aceee
BASECAMP_REDIRECT_URI=http://localhost:5173/auth/callback
SESSION_SECRET=your-random-secret-key-change-in-production
```

## Notes

- The `.env` file is already in `.gitignore` and will not be committed to version control
- `SESSION_SECRET` should be a random string for production (used for cookie encryption)
- Make sure `BASECAMP_REDIRECT_URI` matches the redirect URI configured in your Basecamp app settings


