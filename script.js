const API_KEY_STORAGE = "lankaTube.youtubeApiKey";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const DEFAULT_QUERY = "Sri Lanka Sinhala";
const APP_CONFIG = window.LANKA_TUBE_CONFIG || {};

const grid = document.getElementById("videoGrid");
const chips = document.getElementById("chips");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const notificationsPanel = document.getElementById("notificationsPanel");
const profilePanel = document.getElementById("profilePanel");
const createModal = document.getElementById("createModal");
const playerModal = document.getElementById("playerModal");
const authModal = document.getElementById("authModal");
const feedFooter = document.getElementById("feedFooter");
const liveSearchResults = document.getElementById("liveSearchResults");

let videos = [];
let sharedVideos = [];
let currentQuery = DEFAULT_QUERY;
let nextPageToken = "";
let loading = false;
let selectedVideo = null;
let liveSearchTimer = null;

const FALLBACK_VIDEOS = [
  { id: "SLzeGa6Pqi8", title: "Sinhala Meme Review - Sri Lankan Meme", channel: "Batta Memes", published: " · Popular Sri Lanka video", live: false, image: "https://i.ytimg.com/vi/SLzeGa6Pqi8/hqdefault.jpg" },
  { id: "mVIPgyYcKAk", title: "Sinhala Political Meme Review", channel: "Batta Memes", published: " · Sri Lanka entertainment", live: false, image: "https://i.ytimg.com/vi/mVIPgyYcKAk/hqdefault.jpg" },
  { id: "5B_iOwPrO_E", title: "Sinhala Political Meme Review - EP100", channel: "Batta Memes", published: " · Sri Lanka entertainment", live: false, image: "https://i.ytimg.com/vi/5B_iOwPrO_E/hqdefault.jpg" },
  { id: "fU6xzzJPisY", title: "Sri Lanka Bus Driving Simulator Short Film", channel: "AndG LK", published: " · Sinhala short film", live: false, image: "https://i.ytimg.com/vi/fU6xzzJPisY/hqdefault.jpg" },
  { id: "HZvOjSK-sVI", title: "Sri Lanka Sinhala Short", channel: "YouTube Shorts", published: " · Sri Lanka short", live: false, image: "https://i.ytimg.com/vi/HZvOjSK-sVI/hqdefault.jpg" },
  { id: "vU0hUOanQTc", title: "Sri Lanka Wedding Dance", channel: "YouTube Shorts", published: " · Sri Lanka short", live: false, image: "https://i.ytimg.com/vi/vU0hUOanQTc/hqdefault.jpg" }
];

function getYoutubeApiKey() {
  return APP_CONFIG.youtubeApiKey || localStorage.getItem(API_KEY_STORAGE) || "";
}

function openYouTubeSearch(query) {
  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query || DEFAULT_QUERY)}`, "_blank", "noopener,noreferrer");
}

async function showLiveSearchResults(query) {
  const apiKey = getYoutubeApiKey();
  const searchTerm = query.trim();
  if (!searchTerm) {
    liveSearchResults.classList.remove("open");
    liveSearchResults.innerHTML = "";
    return;
  }
  if (!apiKey) {
    liveSearchResults.classList.add("open");
    liveSearchResults.innerHTML = `<button class="live-search-item" type="button" data-query="${escapeHTML(searchTerm)}"><div class="channel-avatar">Y</div><div class="live-search-copy"><strong>Search YouTube</strong><span>${escapeHTML(searchTerm)}</span></div></button>`;
    liveSearchResults.querySelector(".live-search-item").addEventListener("click", () => openYouTubeSearch(searchTerm));
    return;
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    q: searchTerm,
    safeSearch: "moderate",
    key: apiKey
  });
  try {
    const response = await fetch(`${YOUTUBE_API}?${params.toString()}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Search failed.");
    const items = (result.items || []).filter(item => item.id?.videoId && item.snippet);
    if (!items.length) {
      liveSearchResults.classList.remove("open");
      return;
    }
    liveSearchResults.innerHTML = items.map(item => {
      const snippet = item.snippet;
      const title = snippet.title || "Untitled video";
      const channel = snippet.channelTitle || "YouTube channel";
      const image = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "";
      return `<button class="live-search-item" type="button" data-video-id="${escapeHTML(item.id.videoId)}">
        <img src="${escapeHTML(image)}" alt="">
        <div class="live-search-copy"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(channel)}</span></div>
      </button>`;
    }).join("");
    liveSearchResults.classList.add("open");
    liveSearchResults.querySelectorAll(".live-search-item").forEach((item, index) => {
      item.addEventListener("click", () => {
        const found = items[index];
        openPlayer({
          id: found.id.videoId,
          title: found.snippet.title || "Untitled video",
          channel: found.snippet.channelTitle || "YouTube channel",
          published: formatPublishedDate(found.snippet.publishedAt),
          live: found.snippet.liveBroadcastContent === "live",
          image: found.snippet.thumbnails?.high?.url || ""
        });
        liveSearchResults.classList.remove("open");
      });
    });
  } catch {
    liveSearchResults.classList.remove("open");
  }
}

function openYouTubeSearchInSite(query) {
  selectedVideo = null;
  document.getElementById("youtubePlayer").src =
    `https://www.youtube-nocookie.com/embed/videoseries?listType=search&list=${encodeURIComponent(query || DEFAULT_QUERY)}&autoplay=1&rel=0`;
  document.getElementById("playerTitle").textContent = `YouTube results: ${query || DEFAULT_QUERY}`;
  document.getElementById("playerChannel").textContent = "YouTube";
  document.getElementById("playerChannelAvatar").textContent = "Y";
  document.getElementById("descriptionStats").textContent = "Live YouTube search";
  document.getElementById("descriptionText").textContent = "Results are played inside Lanka Tube.";
  playerModal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatPublishedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return ` · ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

function renderVideos(items) {
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><h2>No videos to show</h2><p>Search YouTube to find public videos.</p><button class="primary-button" id="emptySearch">Search YouTube</button></div>`;
    document.getElementById("emptySearch").addEventListener("click", () => document.getElementById("searchInput").focus());
    feedFooter.innerHTML = "";
    return;
  }

  grid.innerHTML = items.map(video => {
    const live = video.live ? '<span class="duration live-badge">LIVE</span>' : "";
    return `
      <article class="video-card" data-video-id="${escapeHTML(video.id)}" tabindex="0" role="button" aria-label="Play ${escapeHTML(video.title)}">
        <div class="thumb-wrap">
          <img src="${escapeHTML(video.image)}" alt="${escapeHTML(video.title)}" loading="lazy">
          ${live}
        </div>
        <div class="video-details">
          <div class="channel-avatar">${escapeHTML(video.channel.charAt(0).toUpperCase())}</div>
          <div class="video-copy">
            <h3 class="video-title">${escapeHTML(video.title)}</h3>
            <div class="video-meta"><strong>${escapeHTML(video.channel)}</strong>${escapeHTML(video.published)}</div>
          </div>
          <span class="more-button" aria-hidden="true">⋮</span>
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll(".video-card").forEach(card => {
    const play = () => {
      const video = videos.find(item => item.id === card.dataset.videoId);
      if (video) openPlayer(video);
    };
    card.addEventListener("click", play);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        play();
      }
    });
  });

  feedFooter.innerHTML = nextPageToken
    ? '<button class="secondary-button" id="loadMore">Load more videos</button>'
    : "";
  document.getElementById("loadMore")?.addEventListener("click", () => searchYouTube(currentQuery, true));
}

function showFeedMessage(title, message, actionLabel, action) {
  grid.innerHTML = `<div class="empty-state"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p>${actionLabel ? `<button class="primary-button" id="feedAction">${escapeHTML(actionLabel)}</button>` : ""}</div>`;
  feedFooter.innerHTML = "";
  if (actionLabel) document.getElementById("feedAction").addEventListener("click", action);
}

async function searchYouTube(query, append) {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    currentQuery = query || DEFAULT_QUERY;
    const terms = currentQuery.toLowerCase().replace(/sri lanka|sinhala/g, "").trim();
    const matches = terms
      ? FALLBACK_VIDEOS.filter(video => `${video.title} ${video.channel}`.toLowerCase().includes(terms))
      : FALLBACK_VIDEOS;
    nextPageToken = "";
    videos = matches.length ? matches : FALLBACK_VIDEOS;
    renderVideos(videos);
    return;
  }
  if (loading) return;
  loading = true;
  currentQuery = query || DEFAULT_QUERY;
  if (!append) {
    videos = [];
    nextPageToken = "";
    grid.innerHTML = '<div class="empty-state">Searching YouTube…</div>';
    feedFooter.innerHTML = "";
  } else {
    const loadMore = document.getElementById("loadMore");
    if (loadMore) { loadMore.disabled = true; loadMore.textContent = "Loading…"; }
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "50",
    q: currentQuery,
    safeSearch: "moderate",
    key: apiKey
  });
  if (append && nextPageToken) params.set("pageToken", nextPageToken);

  try {
    const response = await fetch(`${YOUTUBE_API}?${params.toString()}`);
    const result = await response.json();
    if (!response.ok) {
      const details = result.error?.message || `YouTube API returned ${response.status}.`;
      throw new Error(details);
    }

    const found = (result.items || []).filter(item => item.id?.videoId && item.snippet).map(item => {
      const snippet = item.snippet;
      return {
        id: item.id.videoId,
        title: snippet.title || "Untitled video",
        channel: snippet.channelTitle || "YouTube channel",
        published: formatPublishedDate(snippet.publishedAt),
        live: snippet.liveBroadcastContent === "live",
        image: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || ""
      };
    });
    nextPageToken = result.nextPageToken || "";
    videos = append ? videos.concat(found) : found;
    if (!videos.length) {
      showFeedMessage("No videos found", "Try a different search term or category.");
      return;
    }
    renderVideos(videos);
  } catch (error) {
    showFeedMessage("YouTube search failed", error.message, "Open YouTube", () => openYouTubeSearch(currentQuery));
  } finally {
    loading = false;
  }
}

function closeOverlays() {
  sidebar.classList.remove("mobile-open");
  notificationsPanel.classList.remove("open");
  profilePanel.classList.remove("open");
  overlay.classList.remove("show");
}

function openPlayer(video) {
  selectedVideo = video;
  document.getElementById("youtubePlayer").src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0`;
  document.getElementById("playerTitle").textContent = video.title;
  document.getElementById("playerChannel").textContent = video.channel;
  document.getElementById("playerChannelAvatar").textContent = video.channel.charAt(0).toUpperCase();
  document.getElementById("descriptionStats").textContent = video.published || "Public YouTube video";
  document.getElementById("descriptionText").textContent = "This video is played using the official YouTube player.";
  playerModal.classList.add("open");
  document.body.style.overflow = "hidden";
}

renderVideos([]);

document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  const query = document.getElementById("searchInput").value.trim();
  liveSearchResults.classList.remove("open");
  chips.querySelectorAll(".chip").forEach(chip => chip.classList.toggle("active", chip.dataset.filter === "All"));
  searchYouTube(query || DEFAULT_QUERY, false);
});

document.getElementById("searchInput").addEventListener("input", event => {
  clearTimeout(liveSearchTimer);
  const query = event.target.value;
  liveSearchTimer = setTimeout(() => showLiveSearchResults(query), 450);
});

document.getElementById("searchInput").addEventListener("focus", event => {
  if (event.target.value.trim()) showLiveSearchResults(event.target.value);
});

document.addEventListener("click", event => {
  if (!event.target.closest(".search")) liveSearchResults.classList.remove("open");
});

chips.addEventListener("click", event => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  chips.querySelectorAll(".chip").forEach(item => item.classList.toggle("active", item === chip));
  const filter = chip.dataset.filter;
  const searchInput = document.getElementById("searchInput");
  if (filter === "Community") {
    renderVideos(sharedVideos);
    return;
  }
  const query = filter === "All" ? (searchInput.value.trim() || DEFAULT_QUERY) : `${filter} Sri Lanka`;
  searchInput.value = filter === "All" ? searchInput.value : filter;
  searchYouTube(query, false);
});

document.getElementById("menuButton").addEventListener("click", () => {
  if (window.innerWidth <= 680) {
    sidebar.classList.toggle("mobile-open");
    overlay.classList.toggle("show");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
});

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    item.classList.add("active");
    const section = item.dataset.section;
    if (section === "Home") searchYouTube(DEFAULT_QUERY, false);
    else if (section === "Shorts") searchYouTube("shorts Sri Lanka", false);
    else if (section === "Subscriptions") showFeedMessage("Sign in required", "Subscriptions need a configured Lanka Tube account.");
    else showFeedMessage("Account setup required", "History, playlists, Watch Later, and liked videos need a configured account.");
    if (window.innerWidth <= 680) closeOverlays();
  });
});

document.getElementById("notificationsButton").addEventListener("click", () => {
  notificationsPanel.classList.toggle("open");
  profilePanel.classList.remove("open");
  overlay.classList.toggle("show", notificationsPanel.classList.contains("open"));
});
document.getElementById("profileButton").addEventListener("click", () => {
  profilePanel.classList.toggle("open");
  notificationsPanel.classList.remove("open");
});
document.getElementById("createButton").addEventListener("click", () => createModal.classList.add("open"));
document.querySelectorAll(".modal-close").forEach(button => button.addEventListener("click", () => {
  createModal.classList.remove("open");
  authModal.classList.remove("open");
}));

document.querySelectorAll(".create-option").forEach(button => {
  button.addEventListener("click", () => {
    createModal.classList.remove("open");
    showFeedMessage("Not available yet", "Uploading and live streaming need a backend. Share a public YouTube link by searching for it.");
  });
});

overlay.addEventListener("click", closeOverlays);
document.querySelector(".panel-close").addEventListener("click", closeOverlays);

document.getElementById("playerModal").addEventListener("click", event => {
  if (event.target === playerModal) closePlayer();
});
function closePlayer() {
  playerModal.classList.remove("open");
  document.getElementById("youtubePlayer").src = "";
  document.body.style.overflow = "";
}
document.querySelector(".player-close").addEventListener("click", closePlayer);
document.getElementById("likeButton").addEventListener("click", () => {
  if (selectedVideo) window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(selectedVideo.id)}`, "_blank", "noopener,noreferrer");
});
document.getElementById("shareVideo").addEventListener("click", async event => {
  if (!selectedVideo) return;
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(selectedVideo.id)}`;
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Link copied";
    setTimeout(() => { button.textContent = "↗ Share"; }, 1800);
  } catch {
    window.prompt("Copy this YouTube link:", url);
  }
});

document.getElementById("brandHome").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  chips.querySelectorAll(".chip").forEach(chip => chip.classList.toggle("active", chip.dataset.filter === "All"));
  searchYouTube(DEFAULT_QUERY, false);
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.querySelector(".mic-button").addEventListener("click", () => {
  const searchInput = document.getElementById("searchInput");
  searchInput.placeholder = "කතා කරලා සොයන්න...";
  searchInput.focus();
  setTimeout(() => { searchInput.placeholder = "සොයන්න"; }, 3000);
});
document.getElementById("signInButton").addEventListener("click", async () => {
  profilePanel.classList.remove("open");
  if (window.lankaTubeCurrentUser) {
    try {
      await window.lankaTubeFirebase?.signOut();
    } catch (error) {
      document.getElementById("accountNote").textContent = error.message;
    }
    return;
  }
  document.getElementById("authStatus").textContent = window.lankaTubeFirebase?.configured
    ? "Choose Google or enter a phone number with country code."
    : "Firebase is not configured yet. Add your Firebase web app config to firebase-config.js.";
  authModal.classList.add("open");
});
document.getElementById("googleSignIn").addEventListener("click", async () => {
  try {
    await window.lankaTubeFirebase?.signInGoogle();
  } catch (error) {
    document.getElementById("authStatus").textContent = error.message;
  }
});
document.getElementById("phoneAuthForm").addEventListener("submit", async event => {
  event.preventDefault();
  const phone = document.getElementById("phoneNumber").value.trim();
  try {
    await window.lankaTubeFirebase?.sendPhoneCode(phone);
    document.getElementById("phoneCodeGroup").hidden = false;
    document.getElementById("authStatus").textContent = "Verification code sent. Enter the SMS code to continue.";
  } catch (error) {
    document.getElementById("authStatus").textContent = error.message;
  }
});
document.getElementById("verifyPhoneCode").addEventListener("click", async () => {
  const code = document.getElementById("phoneCode").value.trim();
  try {
    await window.lankaTubeFirebase?.verifyPhoneCode(code);
  } catch (error) {
    document.getElementById("authStatus").textContent = error.message;
  }
});
document.getElementById("shareToLankaTube").addEventListener("click", async () => {
  if (!selectedVideo) return;
  if (!window.lankaTubeCurrentUser) {
    authModal.classList.add("open");
    document.getElementById("authStatus").textContent = "Sign in to share this YouTube video with everyone on Lanka Tube.";
    return;
  }
  try {
    await window.lankaTubeFirebase?.publishVideo(selectedVideo);
    closePlayer();
    chips.querySelectorAll(".chip").forEach(chip => chip.classList.toggle("active", chip.dataset.filter === "Community"));
    renderVideos(sharedVideos);
  } catch (error) {
    document.getElementById("authStatus").textContent = error.message;
    authModal.classList.add("open");
  }
});

window.addEventListener("lankaTubeAuthState", event => {
  const user = event.detail;
  window.lankaTubeCurrentUser = user;
  document.getElementById("accountName").textContent = user ? (user.displayName || "Lanka Tube user") : "Signed out";
  document.getElementById("accountIdentifier").textContent = user ? (user.email || user.phoneNumber || "") : "Lanka Tube account";
  document.getElementById("accountAvatar").textContent = user?.displayName?.charAt(0)?.toUpperCase() || "L";
  document.getElementById("signInButton").textContent = user ? "Sign out" : "Sign in with Google / phone";
  document.getElementById("authStatus").textContent = user ? "Signed in successfully." : "Choose Google or enter a phone number with country code.";
  if (user) {
    authModal.classList.remove("open");
    document.getElementById("phoneCodeGroup").hidden = true;
  }
});
window.addEventListener("lankaTubeSharedVideos", event => {
  sharedVideos = (event.detail || []).map(item => ({
    id: item.videoId,
    title: item.title,
    channel: item.channel || "Lanka Tube community",
    published: item.createdAt ? ` · Shared ${formatPublishedDate(item.createdAt).replace(/^ · /, "")}` : " · Recently shared",
    live: false,
    image: `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/hqdefault.jpg`
  }));
  if (chips.querySelector(".chip.active")?.dataset.filter === "Community") renderVideos(sharedVideos);
});
window.addEventListener("lankaTubeFirebaseError", event => {
  document.getElementById("accountNote").textContent = event.detail?.message || "Firebase setup error.";
});
window.addEventListener("lankaTubeFirebaseStatus", event => {
  if (event.detail?.configured) document.getElementById("accountNote").textContent = "Signed-in members can share YouTube links.";
});

searchYouTube(DEFAULT_QUERY, false);
