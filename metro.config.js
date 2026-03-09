const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// Zustand 등 ESM(import.meta) 패키지 때문에 웹에서 SyntaxError 방지
config.resolver.unstable_enablePackageExports = false;
module.exports = withNativeWind(config, { input: "./global.css" });
