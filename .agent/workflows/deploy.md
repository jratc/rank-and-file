---
description: Deploy the application to Vercel after committing changes
---

This workflow automates the process of committing changes and deploying to Vercel.

1. Ensure all changes are committed:
```bash
git add .
git commit -m "Deployment commit"
```

// turbo
2. Deploy to Vercel:
```bash
vercel --prod --yes
```

3. Verify the deployment:
- Check the Vercel dashboard or the provided deployment URL.
- Open the site and verify core functionality.
