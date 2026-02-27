import { type ReactNode, useCallback, useMemo, useEffect } from "react";
import { useAppConfig } from "@/config/hooks";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";

export function DynamicContent({ children }: { children: ReactNode }) {
  const config = useAppConfig();
  const isMobile = useIsMobile();
  const { appearance } = useTheme();

  const getUrlFromConfig = useCallback(
    (urls: string) => {
      if (!urls) return "";
      const themes = urls.split("|").map((theme) => theme.trim());
      const themeIndex = appearance === "dark" ? 1 : 0;
      const selectedTheme =
        themes.length > themeIndex ? themes[themeIndex] : themes[0] || "";
      const themeUrls = selectedTheme
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      const randomIndex = Math.floor(Math.random() * themeUrls.length);
      return themeUrls[randomIndex] || "";
    },
    [appearance]
  );

  const backgroundMode = config.backgroundMode || "image";

  const imageUrl = useMemo(() => {
    if (!config || backgroundMode !== "image") return "";
    const { backgroundImage, backgroundImageMobile } = config;
    return isMobile && backgroundImageMobile
      ? getUrlFromConfig(backgroundImageMobile)
      : getUrlFromConfig(backgroundImage);
  }, [config, isMobile, getUrlFromConfig, backgroundMode]);

  const videoUrl = useMemo(() => {
    if (!config || backgroundMode !== "video") return "";
    const { videoBackgroundUrl, videoBackgroundUrlMobile } = config;
    return isMobile && videoBackgroundUrlMobile
      ? getUrlFromConfig(videoBackgroundUrlMobile)
      : getUrlFromConfig(videoBackgroundUrl);
  }, [config, isMobile, getUrlFromConfig, backgroundMode]);

  const solidColor = useMemo(() => {
    if (!config || backgroundMode !== "solidColor") return "";
    return config.solidColorBackground || "";
  }, [config, backgroundMode]);

  const dynamicStyles = useMemo(() => {
    if (!config) return "";
    const { mainWidth, blurValue, blurBackgroundColor } = config;
    const styles: string[] = [];

    styles.push(`--main-width: ${mainWidth}vw;`);
    styles.push(`--body-background-url: url(${imageUrl});`);
    styles.push(`--purcarte-blur: ${blurValue}px;`);

    const colors = blurBackgroundColor.split("|").map((color) => color.trim());
    if (colors.length >= 2) {
      styles.push(`--card-light: ${colors[0]};`);
      styles.push(`--card-dark: ${colors[1]};`);
    } else if (colors.length === 1) {
      styles.push(`--card-light: ${colors[0]};`);
      styles.push(`--card-dark: ${colors[0]};`);
    }

    return `:root { ${styles.join(" ")} }`;
  }, [config, imageUrl]);

  useEffect(() => {
    const imageBackground = document.getElementById("image-background");
    const videoBackground = document.getElementById(
      "video-background"
    ) as HTMLVideoElement;
    const [size, position] = config.backgroundAlignment
      .split(",")
      .map((s) => s.trim());

    if (imageBackground) {
      if (backgroundMode === "solidColor" && solidColor) {
        imageBackground.style.backgroundImage = "none";
        imageBackground.style.backgroundColor = solidColor;
      } else if (backgroundMode === "image" && imageUrl) {
        imageBackground.style.backgroundColor = "";
        imageBackground.style.backgroundImage = `url(${imageUrl})`;
        imageBackground.style.backgroundSize = size;
        imageBackground.style.backgroundPosition = position;
      } else {
        imageBackground.style.backgroundImage = "none";
        imageBackground.style.backgroundColor = "";
      }
    }

    if (videoBackground) {
      if (backgroundMode === "video" && videoUrl) {
        videoBackground.src = videoUrl;
        videoBackground.style.objectFit = size;
        videoBackground.style.objectPosition = position;
        videoBackground.style.display = "block";
      } else {
        videoBackground.src = "";
        videoBackground.style.display = "none";
      }
    }
  }, [
    imageUrl,
    videoUrl,
    solidColor,
    backgroundMode,
    config.backgroundAlignment,
  ]);

  return (
    <>
      <style>{dynamicStyles}</style>
      <div className="fade-in">{children}</div>
    </>
  );
}
