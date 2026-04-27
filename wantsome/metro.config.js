const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
// Zustand 등 ESM(import.meta) 패키지 때문에 웹에서 SyntaxError 방지
config.resolver.unstable_enablePackageExports = false;
// android/.cxx (네이티브 빌드 캐시) 감시 제외 — Metro FallbackWatcher ENOENT 방지
config.watchFolders = (config.watchFolders ?? []);
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules[/\\].*[/\\]android[/\\]\.cxx[/\\].*/,
  /android[/\\]\.cxx[/\\].*/,
];
module.exports = withNativeWind(config, { input: "./global.css" });
