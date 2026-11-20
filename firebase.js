const firebaseConfig = window.LANKA_TUBE_CONFIG?.firebase;

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function notConfigured() {
  return Promise.reject(new Error("Add the Firebase web app config to firebase-config.js and enable Authentication and Firestore."));
}

window.lankaTubeFirebase = {
  configured: false,
  signInGoogle: notConfigured,
  sendPhoneCode: notConfigured,
  verifyPhoneCode: notConfigured,
  signOut: notConfigured,
  publishVideo: notConfigured
};

if (firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.appId) {
  try {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);

    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    const db = firestoreSdk.getFirestore(app);
    let phoneConfirmation = null;
    let recaptchaVerifier = null;

    window.lankaTubeFirebase = {
      configured: true,
      signInGoogle: () => authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider()),
      sendPhoneCode: async phoneNumber => {
        if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
          throw new Error("Enter a valid phone number in international format, such as +94771234567.");
        }
        if (!recaptchaVerifier) {
          recaptchaVerifier = new authSdk.RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
        }
        phoneConfirmation = await authSdk.signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      },
      verifyPhoneCode: async code => {
        if (!phoneConfirmation) throw new Error("Send the SMS verification code first.");
        if (!code) throw new Error("Enter the SMS verification code.");
        await phoneConfirmation.confirm(code);
        phoneConfirmation = null;
      },
      signOut: () => authSdk.signOut(auth),
      publishVideo: async video => {
        if (!auth.currentUser) throw new Error("Sign in before sharing a video.");
        if (!/^[A-Za-z0-9_-]{11}$/.test(video.id)) throw new Error("This is not a valid YouTube video.");
        await firestoreSdk.addDoc(firestoreSdk.collection(db, "sharedVideos"), {
          videoId: video.id,
          title: String(video.title).slice(0, 250),
          channel: String(video.channel).slice(0, 150),
          userId: auth.currentUser.uid,
          createdAt: firestoreSdk.serverTimestamp()
        });
      }
    };

    authSdk.onAuthStateChanged(auth, user => {
      emit("lankaTubeAuthState", user ? {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber
      } : null);
    });

    const sharedVideosQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "sharedVideos"),
      firestoreSdk.orderBy("createdAt", "desc"),
      firestoreSdk.limit(100)
    );
    firestoreSdk.onSnapshot(sharedVideosQuery, snapshot => {
      emit("lankaTubeSharedVideos", snapshot.docs.map(document => {
        const data = document.data();
        return {
          videoId: data.videoId,
          title: data.title,
          channel: data.channel,
          createdAt: data.createdAt?.toDate().toISOString() || null
        };
      }));
    }, error => emit("lankaTubeFirebaseError", { message: `Shared feed error: ${error.message}` }));

    emit("lankaTubeFirebaseStatus", { configured: true });
  } catch (error) {
    emit("lankaTubeFirebaseError", { message: `Firebase could not start: ${error.message}` });
  }
}
