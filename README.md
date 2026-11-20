# Lanka Tube

Lanka Tube is a responsive YouTube discovery app. It searches public videos with the YouTube Data API, plays them in YouTube's embedded player, and can share video links live with other signed-in users through Firebase.

## Configure the app

Edit `firebase-config.js` with the Firebase web app settings:

```js
window.LANKA_TUBE_CONFIG = {
  youtubeApiKey: "",
  firebase: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_FIREBASE_APP_ID"
  }
};
```

Firebase web app settings are public browser/client settings. Never put a Firebase service-account file, private key, or OAuth client secret in this project. The Pages workflow reads the `YOUTUBE_API_KEY` repository Actions secret and injects it into the deployed browser config. The key is visible to site visitors, so restrict it to YouTube Data API v3 and the site's HTTP referrer.

### YouTube search

1. In Google Cloud Console, create/select a project and enable **YouTube Data API v3**.
2. Create an API key. Restrict it to the YouTube Data API v3 and HTTP referrers for local development and the final GitHub Pages site.
3. Add it as the repository Actions secret `YOUTUBE_API_KEY` (**Settings → Secrets and variables → Actions**) before deployment. Do not commit the key to the source file.

Search returns up to 50 results per page. YouTube's API does not provide an endpoint to list every video on the platform; use search and Load more.

The Home feed is ordered by newest publish date and uses Sri Lanka region plus Sinhala/Tamil search terms and Sinhala relevance to favor local videos. YouTube does not provide a reliable channel-country filter, so results cannot be guaranteed to be exclusively Sri Lankan. Use the Refresh button to fetch the latest results manually; there is no timed auto-refresh, to avoid consuming YouTube API quota for every visitor.

The Shorts tab searches for `#shorts` videos shorter than four minutes and plays selected videos in a vertical player. YouTube's Data API does not expose a dedicated Shorts-only search filter.

Watch history is saved persistently in the current browser's local storage. It is not synced between devices and will be removed if that browser's site data is cleared. Google-account sync requires Firebase configuration.

Video playback and available quality are controlled by YouTube's embedded player. Viewers can choose the highest available quality from the player's settings; background playback while a phone screen is off depends on YouTube and the device/browser and cannot be guaranteed by this site.

### Firebase login and shared links

1. Register a Web app in Firebase Console and copy its web app config into `firebase-config.js`.
2. In **Authentication → Sign-in method**, enable Google and Phone. Add `localhost` and the GitHub Pages host to **Authorized domains**.
3. Create a Firestore database.
4. Publish the rules from `firestore.rules` in **Firestore Database → Rules**. They allow public feed reads, require sign-in to add links, validate YouTube IDs and link fields, and allow authors to remove their own entries only.
5. Phone sign-in uses Firebase's SMS verification and reCAPTCHA; configure the Firebase phone-auth settings and any required billing/quotas in the project.

The Lanka Tube community feed is read in real time. Users share YouTube links; videos remain hosted and played by YouTube. Uploading video files to Lanka Tube and subscriptions to Lanka Tube creators require a configured backend and Firebase Storage; the current app does not store uploaded video files.

## Run locally

Serve this folder over HTTP (not `file://`), for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Publish on GitHub Pages

1. Before publishing, add the Firebase web app config to `firebase-config.js` and set the restricted `YOUTUBE_API_KEY` Actions secret if you want shared search for all visitors. Never put server credentials or private keys in the public source. Restrict the YouTube key to YouTube Data API v3 and the site's HTTP referrer, such as `https://<username>.github.io/*`.
2. Create a GitHub repository, then upload/push this project to its `main` branch.
3. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
4. The workflow in `.github/workflows/pages.yml` deploys the site on every push to `main`. Find the website URL in the workflow run or under **Settings → Pages**.
5. Add the published host (for example, `<username>.github.io`) to Firebase Authentication's **Authorized domains**. Confirm that the Firestore rules from `firestore.rules` are published.
