import type { MapType } from "./interfaces";

// Enter your credentials here
//TestApp
export const CLIENT_ID = "4f73bb67-c153-4e41-84d0-80e0b65b2da2";
export const CLIENT_SECRET = "b02a35f595f717d6f0517ff9140d146b70a89a4aafa7073d3010a1a6a52eb393";
export const CURRENT_MAP_TYPE: MapType = "map";
export const CODE = "MAP_UFD36OHV5XUD"; //"MapCode/MapsetCode";


// API endpoints (do not modify)
export const SDK_AUTH_URL = "https://api.multiset.ai/v1/m2m/token";
export const QUERY_URL = "https://api.multiset.ai/v1/vps/map/query-form";
export const MAP_DETAILS_URL = "https://api.multiset.ai/v1/vps/map/";
export const FILE_DOWNLOAD_URL = "https://api.multiset.ai/v1/file";