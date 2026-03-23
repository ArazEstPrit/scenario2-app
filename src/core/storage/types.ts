export interface StoreMap {}

export type StoreName = keyof StoreMap;

export interface Store<N extends StoreName> {
	name: N;
	data: StoreMap[N];
}
