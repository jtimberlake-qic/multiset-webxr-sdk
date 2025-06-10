import type { MapType } from "./interfaces";

// Enter your credentials here
export const CLIENT_ID = "YOUR_CLIENT_ID";
export const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
export const CURRENT_MAP_TYPE: MapType = "map";
export const CODE = "MapCode/MapsetCode";

// API endpoints (do not modify)
export const SDK_AUTH_URL = "https://api.multiset.ai/v1/m2m/token";
export const QUERY_URL = "https://api.multiset.ai/v1/vps/map/query-form";
export const MAP_DETAILS_URL = "https://api.multiset.ai/v1/vps/map/";
export const FILE_DOWNLOAD_URL = "https://api.multiset.ai/v1/file";