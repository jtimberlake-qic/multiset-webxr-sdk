export type MapType = "map" | "map-set";

export interface IPosition {
    x: number,
    y: number,
    z: number
}

export interface IRotation {
    x: number,
    y: number,
    z: number,
    w: number,
}

export interface ILocalizeResponse {
    poseFound: boolean;
    position: IPosition;
    rotation: IRotation;
    retrieval_scores: number[];
    num_matches: number[];
    confidence: number;
    retreived_imgs: string[];
    mapIds: string[];
}

export interface ILocalizeAndMapDetails {
    localizeData: ILocalizeResponse;
    mapDetails?: IGetMapsDetailsResponse;
}

export interface IMapLocation {
    type: string;
    coordinates: [number, number, number];
    _id: string;
}

export interface ICameraIntrinsics {
    fx: number;
    fy: number;
    px: number;
    py: number;
}

export interface IMeshInfo {
    type: string;
    meshLink: string;
}

export interface IMapMesh {
    rawMesh: IMeshInfo;
    texturedMesh: IMeshInfo;
}

export interface IResolution {
    width: number;
    height: number;
}

export interface IMapSource {
    provider: string;
    fileType: string;
    coordinateSystem: string;
}

export interface IGetMapsDetailsResponse {
    _id: string;
    accountId: string;
    mapName: string;
    location: IMapLocation;
    status: string;
    storage: number;
    createdAt: string;
    updatedAt: string;
    cameraIntrinsics: ICameraIntrinsics;
    mapMesh: IMapMesh;
    resolution: IResolution;
    globalFeature: string;
    mapCode: string;
    source: IMapSource;
}
