# Deployment Guide: Private Repository (Netlify)

Since you want to keep your code private, we will use **Netlify**. Unlike GitHub Pages, Netlify allows you to host websites from private repositories for free.

## Prerequisites
- A **GitHub Account** (with your repository set to **Private**).
- A free **Netlify Account** (sign up at [app.netlify.com](https://app.netlify.com)).

## Step 1: Set Repository to Private
1. Go to your GitHub repository: [https://github.com/KevinPratap/machines-dealer](https://github.com/KevinPratap/machines-dealer).
2. Click **Settings** (top menu).
3. Scroll to the bottom ("Danger Zone") and click **Change visibility**.
4. Select **Make private** and follow the instructions.

## Step 2: Deploy to Netlify
1. Log in to your [Netlify](https://app.netlify.com) dashboard.
2. Click **Add new site** > **Import an existing project**.
3. Select **GitHub**.
4. Authorize Netlify and search for `machines-dealer`.
5. Leave the settings as default (Build command: empty, Publish directory: `.`).
6. Click **Deploy machines-dealer**.

## Step 3: Get the Link
1. Netlify will generate a random URL like `https://funny-bunny-123.netlify.app`.
2. You can send this link to the owner! It will stay live and private (the code is protected, but the website is viewable).

---

## Important Note on Admin Panel
Since this is a static host:
- The Admin Panel will work perfectly in "Demo Mode."
- Changes are saved to the user's browser storage. This allows the owner to test the UI and see their edits immediately without affecting your actual code files.
