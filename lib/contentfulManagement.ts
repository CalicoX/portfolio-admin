import { createClient } from 'contentful-management';
import { fetchWithMgmtCache, invalidateMgmtCache } from './contentfulManagementCache';

const TOKEN_STORAGE_KEY = 'contentful_cma_token';

// Helper to manage token
export const setManagementToken = (token: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const getManagementToken = () => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const hasManagementToken = () => {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const clearManagementToken = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
};

// Initialize the Contentful Management API client
const getManagementClient = () => {
    const token = getManagementToken();
    if (!token) {
        throw new Error('CONTENTFUL_TOKEN_MISSING');
    }
    return createClient({
        accessToken: token,
    });
};

const SPACE_ID = import.meta.env.VITE_CONTENTFUL_SPACE_ID || '';
const ENVIRONMENT_ID = 'master';

// Get the environment for CRUD operations
const getEnvironment = async () => {
    const client = getManagementClient();
    const space = await client.getSpace(SPACE_ID);
    return space.getEnvironment(ENVIRONMENT_ID);
};

// Photo CRUD operations
export interface PhotoInput {
    title: string;
    location: string;
    date?: string;
    aspectRatio?: string;
    imageAssetId?: string; // Reference to uploaded asset
}

// Create a new photo entry
export const createPhoto = async (data: PhotoInput) => {
    const environment = await getEnvironment();

    const fields: any = {
        title: { 'en-US': data.title },
        location: { 'en-US': data.location },
        aspectRatio: { 'en-US': data.aspectRatio || 'aspect-[3/4]' },
    };

    // Only include date if it has a value
    if (data.date) {
        fields.date = { 'en-US': data.date };
    }

    // Only include image if it has an asset ID
    if (data.imageAssetId) {
        fields.image = {
            'en-US': {
                sys: {
                    type: 'Link',
                    linkType: 'Asset',
                    id: data.imageAssetId,
                },
            },
        };
    }

    const entry = await environment.createEntry('photo', { fields });

    // Publish the entry
    await entry.publish();

    // 清除相关缓存
    invalidateMgmtCache('photo');

    return entry;
};

// Update an existing photo entry
export const updatePhoto = async (entryId: string, data: Partial<PhotoInput>) => {
    const environment = await getEnvironment();
    const entry = await environment.getEntry(entryId);

    if (data.title !== undefined) {
        entry.fields.title = { 'en-US': data.title };
    }
    if (data.location !== undefined) {
        entry.fields.location = { 'en-US': data.location };
    }
    if (data.date !== undefined) {
        entry.fields.date = { 'en-US': data.date };
    }
    if (data.aspectRatio !== undefined) {
        entry.fields.aspectRatio = { 'en-US': data.aspectRatio };
    }
    if (data.imageAssetId !== undefined) {
        entry.fields.image = {
            'en-US': {
                sys: {
                    type: 'Link',
                    linkType: 'Asset',
                    id: data.imageAssetId,
                },
            },
        };
    }

    const updatedEntry = await entry.update();
    await updatedEntry.publish();

    // 清除相关缓存
    invalidateMgmtCache('photo');
    invalidateMgmtCache('photo', entryId);

    return updatedEntry;
};

// Delete a photo entry
export const deletePhoto = async (entryId: string) => {
    const environment = await getEnvironment();
    const entry = await environment.getEntry(entryId);

    // Unpublish before delete
    try {
        await entry.unpublish();
    } catch (e) {
        // Entry might not be published
    }

    await entry.delete();

    // 清除相关缓存
    invalidateMgmtCache('photo');
    invalidateMgmtCache('photo', entryId);
};

// Upload an image asset
export const uploadAsset = async (file: File): Promise<string> => {
    const environment = await getEnvironment();

    // Create the asset
    const asset = await environment.createAssetFromFiles({
        fields: {
            title: { 'en-US': file.name },
            file: {
                'en-US': {
                    contentType: file.type,
                    fileName: file.name,
                    file: file,
                },
            },
        },
    });

    // Process and publish the asset
    const processedAsset = await asset.processForAllLocales();
    await processedAsset.publish();

    return processedAsset.sys.id;
};

// Get all photos (using Management API for admin)
export const getPhotosAdmin = async (options?: { skipCache?: boolean }) => {
    return fetchWithMgmtCache(
        async () => {
            const environment = await getEnvironment();
            const entries = await environment.getEntries({
                content_type: 'photo',
            });

            // Get all asset IDs
            const assetIds = entries.items
                .map((item: any) => item.fields.image?.['en-US']?.sys?.id)
                .filter(Boolean);

            // Fetch assets to get URLs
            const assetMap = new Map<string, string>();
            if (assetIds.length > 0) {
                const assets = await environment.getAssets({
                    'sys.id[in]': assetIds.join(','),
                });
                assets.items.forEach((asset: any) => {
                    const url = asset.fields.file?.['en-US']?.url;
                    if (url) {
                        assetMap.set(asset.sys.id, `https:${url}`);
                    }
                });
            }

            return entries.items.map((item: any) => {
                const assetId = item.fields.image?.['en-US']?.sys?.id;
                return {
                    id: item.sys.id,
                    title: item.fields.title?.['en-US'] || '',
                    location: item.fields.location?.['en-US'] || '',
                    date: item.fields.date?.['en-US'] || '',
                    aspectRatio: item.fields.aspectRatio?.['en-US'] || 'aspect-[3/4]',
                    imageAssetId: assetId || null,
                    imageUrl: assetId ? assetMap.get(assetId) || null : null,
                    isPublished: item.sys.publishedVersion !== undefined,
                };
            });
        },
        'photo',
        { skipCache: options?.skipCache }
    );
};

// ============ INDEX (Site Profile) CRUD ============

export interface IndexInput {
    heroTitle: string;
    heroSubtitle: string;
    name: string;
    description: string;
    cvLink?: string;
    profileImageAssetId?: string;
}

// Get Index/Site Profile entry
export const getIndexAdmin = async (options?: { skipCache?: boolean }) => {
    return fetchWithMgmtCache(
        async () => {
            const environment = await getEnvironment();
            const entries = await environment.getEntries({
                content_type: 'index',
                limit: 1,
            });

            if (entries.items.length === 0) {
                return null;
            }

            const item = entries.items[0] as any;
            const assetId = item.fields.profileImage?.['en-US']?.sys?.id;

            // Get profile image URL
            let imageUrl = null;
            if (assetId) {
                try {
                    const asset = await environment.getAsset(assetId);
                    const url = asset.fields.file?.['en-US']?.url;
                    if (url) {
                        imageUrl = `https:${url}`;
                    }
                } catch (e) {
                    // Asset not found
                }
            }

            return {
                id: item.sys.id,
                heroTitle: item.fields.heroTitle?.['en-US'] || '',
                heroSubtitle: item.fields.heroSubtitle?.['en-US'] || '',
                name: item.fields.name?.['en-US'] || '',
                description: item.fields.description?.['en-US'] || '',
                cvLink: item.fields.cvLink?.['en-US'] || '',
                profileImageAssetId: assetId || null,
                profileImageUrl: imageUrl,
                isPublished: item.sys.publishedVersion !== undefined,
            };
        },
        'index',
        { skipCache: options?.skipCache }
    );
};

// Update Index entry
export const updateIndex = async (entryId: string, data: Partial<IndexInput>) => {
    const environment = await getEnvironment();
    const entry = await environment.getEntry(entryId);

    if (data.heroTitle !== undefined) {
        entry.fields.heroTitle = { 'en-US': data.heroTitle };
    }
    if (data.heroSubtitle !== undefined) {
        entry.fields.heroSubtitle = { 'en-US': data.heroSubtitle };
    }
    if (data.name !== undefined) {
        entry.fields.name = { 'en-US': data.name };
    }
    if (data.description !== undefined) {
        entry.fields.description = { 'en-US': data.description };
    }
    if (data.cvLink !== undefined) {
        entry.fields.cvLink = { 'en-US': data.cvLink };
    }
    if (data.profileImageAssetId !== undefined) {
        entry.fields.profileImage = {
            'en-US': {
                sys: {
                    type: 'Link',
                    linkType: 'Asset',
                    id: data.profileImageAssetId,
                },
            },
        };
    }

    const updatedEntry = await entry.update();
    await updatedEntry.publish();

    // 清除相关缓存
    invalidateMgmtCache('index');

    return updatedEntry;
};
