"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const artboard = document.querySelector(".artboard");
  const transitionCover = document.querySelector(".transition-cover");
  const scenes = new Map(
    Array.from(document.querySelectorAll("[data-scene]")).map((scene) => [
      scene.dataset.scene,
      scene,
    ]),
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isLocalFile = window.location.protocol === "file:";

  if (isLocalFile) {
    const localStartButton = document.querySelector(".scene-enter");

    if (localStartButton instanceof HTMLButtonElement) localStartButton.hidden = true;
  }

  if (!(artboard instanceof HTMLElement) || !transitionCover || scenes.size === 0) {
    console.error("VELMORTE: no se pudo inicializar la navegación de escenas.");
    return;
  }

  function reportVideoError(video, message) {
    const errorMessage = video.closest("[data-scene]")?.querySelector(".scene-error");

    if (errorMessage instanceof HTMLElement) errorMessage.hidden = false;
    console.error(message);
  }

  let activeScene = "";
  let transitionTimer = 0;
  let isTransitioning = false;

  function updateScale() {
    const widthScale = window.innerWidth / 1440;
    const heightScale = window.innerHeight / 1024;
    const scale =
      window.innerWidth >= 768
        ? Math.max(widthScale, heightScale)
        : Math.min(widthScale, heightScale);
    artboard.style.setProperty("--scene-scale", String(scale));
  }

  function playSceneMedia(sceneName) {
    const scene = scenes.get(sceneName);
    const videos = document.querySelectorAll(".scene-video");

    if (isLocalFile) {
      videos.forEach((video) => {
        if (video instanceof HTMLVideoElement) video.pause();
      });
      return;
    }

    videos.forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;

      if (!scene?.contains(video)) {
        video.pause();
        return;
      }

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.then(() => {
          if (video.matches(".scene-video--intro")) {
            const startButton = scene?.querySelector(".scene-enter");
            if (startButton instanceof HTMLButtonElement) startButton.hidden = true;
          }
        });

        playPromise.catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            const playButton = scene?.querySelector(".scene-play");
            if (playButton instanceof HTMLButtonElement) playButton.hidden = false;
            console.warn("VELMORTE: el navegador requiere interacción para iniciar el vídeo.");
            return;
          }

          reportVideoError(video, `VELMORTE: no se pudo reproducir el vídeo de ${sceneName}.`);
          console.error(error);
        });
      }
    });
  }

  function showScene(sceneName) {
    const selectedScene = scenes.get(sceneName);

    if (!selectedScene) {
      console.error(`VELMORTE: la escena "${sceneName}" no existe.`);
      return false;
    }

    scenes.forEach((scene, name) => {
      scene.hidden = name !== sceneName;
    });

    activeScene = sceneName;
    playSceneMedia(sceneName);

    return true;
  }

  function transitionTo(sceneName, updateAddress = true) {
    if (!scenes.has(sceneName) || sceneName === activeScene || isTransitioning) return;

    isTransitioning = true;
    transitionCover.classList.add("is-transitioning");

    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(
      () => {
        if (showScene(sceneName) && updateAddress) {
          window.history.pushState(null, "", `#${sceneName}`);
        }

        transitionCover.classList.remove("is-transitioning");
        isTransitioning = false;
        transitionTimer = 0;
      },
      reducedMotion.matches ? 0 : 450,
    );
  }

  document.querySelectorAll("[data-scene-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      transitionTo(link.dataset.sceneLink);
    });
  });

  function showAddressScene() {
    const sceneName = window.location.hash.slice(1);

    if (sceneName && scenes.has(sceneName)) {
      window.clearTimeout(transitionTimer);
      isTransitioning = false;
      transitionCover.classList.remove("is-transitioning");
      showScene(sceneName);
    }
  }

  window.addEventListener("hashchange", showAddressScene);
  window.addEventListener("popstate", showAddressScene);
  window.addEventListener("resize", updateScale);
  const introVideo = document.querySelector(".scene-video--intro");
  const introStartButton = document.querySelector(".scene-enter");

  if (introVideo instanceof HTMLVideoElement && introStartButton instanceof HTMLButtonElement) {
    const startIntroVideo = () => {
      if (isLocalFile) return;
      if (!introVideo.paused) return;

      introVideo.muted = true;
      introVideo.defaultMuted = true;
      introVideo.playsInline = true;

      const playPromise = introVideo.play();

      if (playPromise) {
        playPromise.then(() => {
          introStartButton.hidden = true;
        }).catch((error) => {
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            const fallbackButton = introVideo.closest("[data-scene]")?.querySelector(".scene-play");
            if (fallbackButton instanceof HTMLButtonElement) fallbackButton.hidden = false;
            console.warn("VELMORTE: el navegador requiere interacción para iniciar el vídeo.");
            return;
          }

          reportVideoError(introVideo, "VELMORTE: no se pudo reproducir el vídeo de introducción.");
          console.error(error);
        });
      }
    };

    introVideo.closest("[data-scene]")?.addEventListener("pointerdown", startIntroVideo);
    introStartButton.addEventListener("click", startIntroVideo);
  }

  if (introVideo instanceof HTMLVideoElement) {
    introVideo.addEventListener("ended", () => {
      if (activeScene === "intro") transitionTo("main");
    });
  }

  document.querySelectorAll(".scene-video").forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;

    video.addEventListener(
      "error",
      () => {
        reportVideoError(video, `VELMORTE: no se pudo cargar el vídeo de ${video.closest("[data-scene]")?.id}.`);
      },
      { once: true },
    );
  });

  document.querySelectorAll(".scene-play").forEach((button) => {
    button.addEventListener("click", () => {
      const video = button.closest("[data-scene]")?.querySelector(".scene-video");

      if (!(video instanceof HTMLVideoElement)) {
        console.error("VELMORTE: no se encontró el vídeo para el botón de reproducción.");
        return;
      }

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      const playPromise = video.play();
      if (!playPromise) return;

      playPromise.then(() => {
        button.hidden = true;
      }).catch((error) => {
        reportVideoError(video, "VELMORTE: no se pudo reproducir el vídeo.");
        console.error(error);
      });
    });
  });

  const mainVideo = document.querySelector(".scene-video--main");

  if (mainVideo instanceof HTMLVideoElement) {
    mainVideo.addEventListener("ended", () => {
      if (activeScene === "main") transitionTo("menu");
    });
  }

  updateScale();
  const initialScene = window.location.hash.slice(1);
  showScene(scenes.has(initialScene) ? initialScene : "intro");
});
