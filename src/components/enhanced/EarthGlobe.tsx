import {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  useMemo,
} from "react";
import { useNodeData } from "@/contexts/NodeDataContext";
import { useUserGeo } from "./useUserGeo";
import { useAppConfig } from "@/config";
import { useTheme } from "@/hooks/useTheme";
import { COORD_MAP, resolveCountryCode } from "./emojiMap";
import type { NodeData } from "@/types/node.d";

// globe.gl 通过 React.lazy 延迟加载
const GlobeComponent = lazy(() => import("./GlobeRenderer"));

interface PointData {
  code: string;
  lat: number;
  lng: number;
  servers: string[];
  type: "server" | "user";
  size: number;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

function processData(
  nodes: NodeData[],
  userLat: number,
  userLng: number,
  userCity: string
): { formattedData: PointData[]; arcsData: ArcData[]; totalCount: number } {
  const groups: Record<string, string[]> = {};
  let count = 0;

  nodes.forEach((node) => {
    const code = resolveCountryCode(node.region);
    if (code) {
      if (!groups[code]) groups[code] = [];
      groups[code].push(node.name);
      count++;
    }
  });

  const formattedData: PointData[] = Object.keys(groups)
    .map((code): PointData | null => {
      const coords = COORD_MAP[code];
      if (!coords) return null;
      return {
        code,
        lat: coords[0],
        lng: coords[1],
        servers: groups[code],
        type: "server",
        size: Math.min(groups[code].length * 0.15, 1.5),
      };
    })
    .filter((item): item is PointData => item !== null);

  // 添加用户位置
  formattedData.push({
    code: "USER",
    lat: userLat,
    lng: userLng,
    servers: [userCity],
    type: "user",
    size: 2.0,
  });

  // 生成弧线数据
  const arcsData: ArcData[] = formattedData
    .filter((item) => item.type === "server")
    .map((item) => ({
      startLat: item.lat,
      startLng: item.lng,
      endLat: userLat,
      endLng: userLng,
    }));

  return { formattedData, arcsData, totalCount: count };
}

export function EarthGlobe() {
  const { nodes } = useNodeData();
  const { geo } = useUserGeo();
  const {
    enableSoloPlay,
    earthLightBgImage,
    earthDarkBgImage,
    earthLightGlobeImage,
    earthDarkGlobeImage,
  } = useAppConfig();
  const { appearance } = useTheme();

  const [ballVisible, setBallVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

  // 延迟显示悬浮球
  useEffect(() => {
    const timer = setTimeout(() => setBallVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // 判断当前是否是暗色模式
  const isDark = useMemo(() => {
    if (appearance === "dark") return true;
    if (appearance === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [appearance]);

  // 获取主题色
  const themeColor = useMemo(() => {
    const cssColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-9")
        .trim();
    const storedColor = localStorage.getItem('color')?.replace(/"/g, '');
    return cssColor || storedColor || "#3b82f6";
  }, [isDark, modalOpen]);

  // 背景配置
  const bgConfig = useMemo(() => {
    const bg = "rgba(0, 0, 0, 0)";
    if (isDark) {
      return {
        bg,
        bgImage: earthDarkBgImage || null,
        globeImage:
          earthDarkGlobeImage ||
          "//upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg",
        atmosphere: themeColor,
      };
    }
    return {
      bg,
      bgImage: earthLightBgImage || null,
      globeImage:
        earthLightGlobeImage ||
        "//upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg",
      atmosphere: "rgba(59, 130, 246, 0.2)",
    };
  }, [
    isDark,
    earthLightBgImage,
    earthDarkBgImage,
    earthLightGlobeImage,
    earthDarkGlobeImage,
    themeColor,
  ]);

  // 处理节点数据
  const { formattedData, arcsData, totalCount } = useMemo(() => {
    const userLat = geo.lat || 35.8617;
    const userLng = geo.lng || 104.1954;
    const userCity = geo.city || "Your Location";

    if (enableSoloPlay) {
      const fakeNodes = Object.keys(COORD_MAP).map((code) => ({
        name: code,
        region: code,
      })) as NodeData[];
      return processData(fakeNodes, userLat, userLng, userCity);
    }
    return processData(nodes, userLat, userLng, userCity);
  }, [nodes, geo, enableSoloPlay]);

  const handleBallClick = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.id === "earth-modal-overlay" ||
      target.id === "earth-modal-content"
    ) {
      setModalOpen(false);
      setGlobeReady(false);
    }
  }, []);

  return (
    <>
      {/* 地球悬浮球 */}
      <div
        id="earth-ball"
        className={`finance-ball${ballVisible && !modalOpen ? " show" : ""}`}
        onClick={handleBallClick}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>

      {/* 地球模态框 */}
      {modalOpen && (
        <div
          id="earth-modal-overlay"
          className="custom-alert-overlay"
          style={{ display: "flex", opacity: 1 }}
          onClick={handleCloseModal}>
          <div
            id="earth-modal-content"
            className="custom-alert-modal"
            style={{ transform: "scale(1)" }}>
            <div className="earth-overlay-counter">
              <span className="counter-label">Total Servers</span>
              <span className="counter-value">{totalCount}</span>
            </div>
            <div
              id="earth-render-area"
              className={globeReady ? "ready" : ""}>
              <Suspense
                fallback={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--gray-11)",
                    }}>
                    加载地球组件中...
                  </div>
                }>
                <GlobeComponent
                  pointsData={formattedData}
                  arcsData={arcsData}
                  bgConfig={bgConfig}
                  themeColor={themeColor}
                  userLat={geo.lat || 35.8617}
                  userLng={geo.lng || 104.1954}
                  onReady={() => {
                    setTimeout(() => setGlobeReady(true), 100);
                  }}
                />
              </Suspense>
            </div>
            <div
              id="earth-tooltip"
              style={{ display: "none" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
