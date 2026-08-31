// Change this to control how much each playlist row expands on hover.
const PLAYLIST_HOVER_EXPAND_PX = 5;

// Change this to update the audio player's font.
const PLAYER_FONT_FAMILY = "\"interRegular\", Arial, sans-serif";
const PLAYER_FONT_WEIGHT = 400;
const PLAYER_TITLE_FONT_WEIGHT = 500;

// Change these once to recolor every playlist track.
const TRACK_COLORS = {
    tile: "#0f0f0f",
    selectedBg: "#ffffff",
    title: "#ffffff",
    artist: "rgba(255, 255, 255, 0.72)",
    selectedTitle: "#000000",
    selectedArtist: "rgba(0, 0, 0, 0.72)"
};

class AudioDemoPlayer {
    constructor(root) {
        this.root = root;
        this.hArtist = root.querySelector(".play-artist");
        this.hName = root.querySelector(".play-name");
        this.hTimeR = root.querySelector(".play-time-range");
        this.hTimeN = root.querySelector(".play-time-current");
        this.hTimeT = root.querySelector(".play-time-total");
        this.hTog = root.querySelector(".play-toggle");
        this.hVolI = root.querySelector(".play-volume-toggle");
        this.hVolR = root.querySelector(".play-volume-range");
        this.hList = root.querySelector(".play-list");
        this.hChapters = root.querySelector(".playbar-chapters");
        this.tracks = [];
        this.pAud = new Audio();
        this.pSeek = false;
        this.pNow = 0;
        this.pStarted = false;
    }

    niceTime(secs) {
        if (!Number.isFinite(secs)) return "0:00";
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
    }

    normalizeChapter(chapter) {
        return {
            time: Number(chapter.time) || 0,
            tag: chapter.tag || ""
        };
    }

    normalizeTrack(track) {
        if (typeof track === "string") {
            const filename = decodeURIComponent(track.split("/").pop() || "Audio Demo");
            return {
                title: filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
                artist: "Boi Instruments",
                src: track,
                chapters: [],
                colors: TRACK_COLORS
            };
        }

        const displayName = track.title || track.name || track.displayName || track.label;
        const sourcePath = track.src || track.path || track.url || "";

        return {
            title: displayName || "Audio Demo",
            artist: track.artist || "Boi Instruments",
            src: sourcePath,
            chapters: Array.isArray(track.chapters)
                ? track.chapters.map(ch => this.normalizeChapter(ch)).filter(ch => Number.isFinite(ch.time))
                : [],
            colors: { ...TRACK_COLORS, ...(track.colors || {}) }
        };
    }

    readTracksFromHtml() {
        const trackData = this.root.querySelector(".audio-track-data");
        if (!trackData) return [];

        try {
            const parsedTracks = JSON.parse(trackData.textContent);
            return Array.isArray(parsedTracks) ? parsedTracks : [];
        } catch (error) {
            console.error("Audio track JSON is invalid:", error);
            return [];
        }
    }

    setRangeFill(range) {
        const max = Number(range.max) || 1;
        const value = Number(range.value) || 0;
        const percent = Math.min(100, Math.max(0, (value / max) * 100));
        range.style.setProperty("--range-fill-percent", `${percent}%`);
    }

    setControlsDisabled(disabled) {
        this.hTimeR.disabled = disabled;
        this.hTog.disabled = disabled;
        this.hVolI.disabled = disabled;
        this.hVolR.disabled = disabled;
    }

    setPlayingState() {
        const isPlaying = !this.pAud.paused;
        this.root.classList.toggle("is-playing", isPlaying);
        this.hTog.setAttribute("aria-label", isPlaying ? "Pause selected track" : "Play selected track");
    }

    setVolumeState() {
        this.hVolI.classList.toggle("is-muted", this.pAud.volume === 0);
        this.hVolI.setAttribute("aria-label", this.pAud.volume === 0 ? "Unmute audio" : "Mute audio");
        this.hVolR.value = this.pAud.volume;
        this.setRangeFill(this.hVolR);
    }

    renderList() {
        this.hList.innerHTML = "";

        this.tracks.forEach((track, index) => {
            const item = document.createElement("button");
            item.className = "playlist-track";
            item.type = "button";
            item.dataset.index = index;
            item.style.setProperty("--active-track-title", track.colors?.title || "var(--playlist-title-color)");
            item.style.setProperty("--active-track-artist", track.colors?.artist || "var(--playlist-artist-color)");
            item.style.setProperty("--active-track-selected-bg", track.colors?.selectedBg || "var(--playlist-row-selected-bg)");
            item.style.setProperty("--active-track-selected-title", track.colors?.selectedTitle || "var(--playlist-row-selected-title)");
            item.style.setProperty("--active-track-selected-artist", track.colors?.selectedArtist || "var(--playlist-row-selected-artist)");
            item.innerHTML = `
                <span class="playlist-track-title">${track.title}</span>
                <span class="playlist-track-artist">${track.artist}</span>
            `;
            item.addEventListener("click", () => this.load(index, true));
            this.hList.appendChild(item);
        });
    }

    init() {
        this.root.style.setProperty("--player-font-family", PLAYER_FONT_FAMILY);
        this.root.style.setProperty("--player-font-weight", PLAYER_FONT_WEIGHT);
        this.root.style.setProperty("--player-title-font-weight", PLAYER_TITLE_FONT_WEIGHT);
        this.root.style.setProperty("--playlist-hover-expand", `${PLAYLIST_HOVER_EXPAND_PX}px`);
        this.tracks = this.readTracksFromHtml().map(track => this.normalizeTrack(track)).filter(track => track.src);

        if (!this.tracks.length) {
            this.hArtist.textContent = "No tracks added";
            this.hName.textContent = "Add tracks in this player's HTML";
            this.setControlsDisabled(true);
            return;
        }

        this.renderList();
        this.setControlsDisabled(true);

        this.pAud.addEventListener("play", () => this.setPlayingState());
        this.pAud.addEventListener("pause", () => this.setPlayingState());
        this.pAud.addEventListener("ended", () => this.load(this.pNow + 1, true));
        this.pAud.addEventListener("loadedmetadata", () => {
            this.hTimeN.textContent = "0:00";
            this.hTimeT.textContent = this.niceTime(this.pAud.duration);
            this.hTimeR.max = Math.max(1, Math.floor(this.pAud.duration));
            this.hTimeR.value = 0;
            this.setRangeFill(this.hTimeR);
            this.renderChapters(this.tracks[this.pNow]);
            this.updateChapterMarkers(0);
            this.setControlsDisabled(false);
        });
        this.pAud.addEventListener("timeupdate", () => {
            if (!this.pSeek) {
                this.hTimeR.value = Math.floor(this.pAud.currentTime);
                this.setRangeFill(this.hTimeR);
            }
            this.hTimeN.textContent = this.niceTime(this.pAud.currentTime);
            this.updateChapterMarkers(this.pAud.currentTime);
        });

        this.hTimeR.addEventListener("input", () => {
            this.pSeek = true;
            this.setRangeFill(this.hTimeR);
            this.hTimeN.textContent = this.niceTime(Number(this.hTimeR.value));
            this.updateChapterMarkers(Number(this.hTimeR.value));
        });
        this.hTimeR.addEventListener("change", () => {
            this.pAud.currentTime = Number(this.hTimeR.value);
            this.pSeek = false;
            if (this.pStarted && this.pAud.paused) this.pAud.play();
        });
        this.hTog.addEventListener("click", () => {
            if (this.pAud.paused) {
                this.pStarted = true;
                this.pAud.play();
            } else {
                this.pAud.pause();
            }
        });
        this.hVolI.addEventListener("click", () => {
            this.pAud.volume = this.pAud.volume === 0 ? 1 : 0;
            this.setVolumeState();
        });
        this.hVolR.addEventListener("input", () => {
            this.pAud.volume = Number(this.hVolR.value);
            this.setVolumeState();
        });

        this.setVolumeState();
        this.load(0, false);
    }

    load(index, autoplay = false) {
        if (!this.tracks.length) return;

        const total = this.tracks.length;
        this.pNow = ((Number(index) % total) + total) % total;
        const track = this.tracks[this.pNow];

        this.setControlsDisabled(true);
        this.pSeek = false;
        this.hArtist.textContent = track.artist;
        this.hName.textContent = track.title;
        this.hTimeN.textContent = "0:00";
        this.hTimeT.textContent = "0:00";
        this.hTimeR.value = 0;
        this.setRangeFill(this.hTimeR);
        this.root.style.setProperty("--active-track-color", track.colors?.tile || "#000000");

        [...this.hList.children].forEach((item, itemIndex) => {
            const isCurrent = itemIndex === this.pNow;
            item.classList.toggle("current", isCurrent);
            item.setAttribute("aria-current", isCurrent ? "true" : "false");
            if (isCurrent) {
                const itemTop = item.offsetTop;
                const itemHeight = item.offsetHeight;
                const listScrollTop = this.hList.scrollTop;
                const listViewHeight = this.hList.clientHeight;

                if (itemTop < listScrollTop || itemTop + itemHeight > listScrollTop + listViewHeight) {
                    this.hList.scrollTop = Math.max(0, itemTop - Math.max(0, (listViewHeight - itemHeight) / 2));
                }
            }
        });

        this.pAud.src = track.src;
        this.pAud.load();

        if (autoplay) {
            this.pStarted = true;
            this.pAud.addEventListener("canplay", () => this.pAud.play(), { once: true });
        }
    }

    renderChapters(track) {
        if (!this.hChapters) return;
        this.hChapters.innerHTML = "";

        if (!track?.chapters?.length) {
            this.hChapters.hidden = true;
            return;
        }

        this.hChapters.hidden = false;
        const duration = Number(this.pAud.duration) || 1;

        track.chapters.forEach((chapter, index) => {
            const percent = Math.min(100, Math.max(0, (chapter.time / duration) * 100));
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "chapter-marker";
            marker.style.left = `${percent}%`;
            marker.dataset.time = String(chapter.time);
            marker.dataset.index = String(index);
            marker.setAttribute("aria-label", `${chapter.tag || "Chapter"}`);
            marker.innerHTML = `<span>${chapter.tag || "Chapter"}</span>`;
            marker.addEventListener("click", event => {
                event.stopPropagation();
                this.pAud.currentTime = chapter.time;
                this.hTimeR.value = chapter.time;
                this.setRangeFill(this.hTimeR);
                this.updateChapterMarkers(chapter.time);
                if (this.pStarted && this.pAud.paused) this.pAud.play();
            });
            this.hChapters.appendChild(marker);
        });
    }

    updateChapterMarkers(currentTime) {
        if (!this.hChapters) return;
        const markers = this.hChapters.querySelectorAll(".chapter-marker");

        markers.forEach(marker => {
            const time = Number(marker.dataset.time) || 0;
            marker.classList.toggle("active", currentTime >= time);
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.scrollTo(0, 0);
    document.querySelectorAll(".audio-player").forEach(root => {
        new AudioDemoPlayer(root).init();
    });
});
