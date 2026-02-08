import { createClient } from 'contentful';
import { Project, ProjectDetail, SiteProfile, Stat, NavItem, Photo, BlogPost } from '../types';
import { fetchWithCache, fetchSingleWithCache, clearContentfulCache, clearAllContentfulCache } from './contentfulCache';

// 重新导出缓存工具
export { clearContentfulCache, clearAllContentfulCache };

const client = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID || '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN || '',
});

export interface ContentfulProject {
  sys: { id: string };
  fields: {
    title: string;
    category: string;
    description?: string;
    content?: any;
    tags?: string | string[];
    year?: string;
    client?: string;
    tools?: string | string[];
    image?: any;
    gallery?: any[];
  };
}

const getImageUrl = (image: any): string => {
  if (!image) return 'https://picsum.photos/800/600';
  if (image.fields?.file?.url) return `https:${image.fields.file.url}`;
  if (image.sys?.type === 'Link') return 'https://picsum.photos/800/600'; // Unresolved link
  return 'https://picsum.photos/800/600';
};

const toStringArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map(v => v.trim()).filter(Boolean);
};

const toProject = (item: any): Project => ({
  id: item.sys.id,
  title: item.fields.title,
  category: item.fields.category,
  imageUrl: getImageUrl(item.fields.image),
});

const toProjectDetail = (item: any): ProjectDetail => {
  const fields = item.fields;
  return {
    id: item.sys.id,
    title: fields.title,
    category: fields.category,
    description: fields.description || '',
    content: fields.content?.content?.map((node: any) => {
      if (node.nodeType === 'paragraph' && node.content) {
        return node.content.map((textNode: any) => textNode.value || '').join('');
      }
      return '';
    }).join('\n\n') || '',
    tags: toStringArray(fields.tags),
    year: fields.year,
    client: fields.client,
    tools: toStringArray(fields.tools),
    imageUrl: getImageUrl(fields.image),
    gallery: fields.gallery?.map((g: any) => getImageUrl(g)) || [],
  };
};

export const getProjects = async (options?: { skipCache?: boolean }): Promise<Project[]> => {
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'portfolio',
        include: 2,
      });
      return { items: response.items };
    },
    {
      contentType: 'portfolio',
      maxAge: 5 * 60 * 1000, // 5 分钟缓存
      skipCache: options?.skipCache,
    }
  );
  return items.map(toProject);
};

export const getProjectById = async (id: string, options?: { skipCache?: boolean }): Promise<ProjectDetail | null> => {
  return fetchSingleWithCache(
    async () => {
      try {
        const response = await client.getEntry(id, { include: 2 });
        return toProjectDetail(response);
      } catch {
        return null;
      }
    },
    {
      contentType: 'portfolio',
      queryKey: id,
      maxAge: 10 * 60 * 1000, // 10 分钟缓存
      skipCache: options?.skipCache,
    }
  );
};

export const getGraphicDesignProjects = async (options?: { skipCache?: boolean }): Promise<Project[]> => {
  // 使用相同的缓存键作为 getProjects，因为查询条件相同
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'portfolio',
        include: 2,
      });
      return { items: response.items };
    },
    {
      contentType: 'portfolio',
      maxAge: 5 * 60 * 1000,
      skipCache: options?.skipCache,
    }
  );
  return items.map(toProject);
};

// Site Profile
export const getSiteProfile = async (options?: { skipCache?: boolean }): Promise<SiteProfile | null> => {
  return fetchSingleWithCache(
    async () => {
      try {
        const response = await client.getEntries({
          content_type: 'index',
          include: 2,
          limit: 1,
        });
        if (response.items.length === 0) return null;
        const item = response.items[0];
        return {
          id: item.sys.id,
          heroTitle: item.fields.heroTitle || '',
          heroSubtitle: item.fields.heroSubtitle || '',
          name: item.fields.name || '',
          description: item.fields.description || '',
          profileImageUrl: getImageUrl(item.fields.profileImage),
          cvLink: item.fields.cvLink || '',
        };
      } catch {
        return null;
      }
    },
    {
      contentType: 'index',
      maxAge: 10 * 60 * 1000, // 10 分钟缓存
      skipCache: options?.skipCache,
    }
  );
};

// Stats
export const getStats = async (options?: { skipCache?: boolean }): Promise<Stat[]> => {
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'stat',
        order: ['fields.order'],
      });
      return { items: response.items };
    },
    {
      contentType: 'stat',
      maxAge: 10 * 60 * 1000, // 10 分钟缓存
      skipCache: options?.skipCache,
    }
  );
  return items.map((item: any) => ({
    id: item.sys.id,
    value: item.fields.value || '',
    label: item.fields.label || '',
    order: item.fields.order || 0,
  }));
};

// Photos
export const getPhotos = async (options?: { skipCache?: boolean }): Promise<Photo[]> => {
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'photo',
        include: 10,
        order: ['-fields.date', '-sys.createdAt'],
      });
      return { items: response.items };
    },
    {
      contentType: 'photo',
      maxAge: 5 * 60 * 1000, // 5 分钟缓存
      skipCache: options?.skipCache,
    }
  );

  // Build asset lookup map from includes
  const assetMap = new Map<string, any>();
  // Note: SDK 返回的数据中 includes 在原始响应中，缓存后可能丢失
  // 这里简化处理，依赖 SDK 已经解析好的链接

  const resolveImageUrl = (image: any): string => {
    if (!image) return 'https://picsum.photos/800/600';
    if (image.fields?.file?.url) return `https:${image.fields.file.url}`;
    if (image.sys?.type === 'Link') {
      // 对于未解析的链接，返回占位图
      return 'https://picsum.photos/800/600';
    }
    return 'https://picsum.photos/800/600';
  };

  return items.map((item: any) => ({
    id: item.sys.id,
    title: item.fields.title || '',
    location: item.fields.location || '',
    imageUrl: resolveImageUrl(item.fields.image),
    aspectRatio: item.fields.aspectRatio || 'aspect-[3/4]',
    date: item.fields.date || '',
  }));
};

// Navigation
export const getNavigation = async (options?: { skipCache?: boolean }): Promise<NavItem[]> => {
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'navigation',
        order: ['fields.order'],
      });
      return { items: response.items };
    },
    {
      contentType: 'navigation',
      maxAge: 30 * 60 * 1000, // 30 分钟缓存（导航不常变）
      skipCache: options?.skipCache,
    }
  );

  if (items.length === 0) {
    // 返回默认导航
    return [
      { id: '1', label: 'Home', path: '/', icon: 'home', order: 0, mobile: 'Home' },
      { id: '2', label: 'UI Design', path: '/ui-design', icon: 'layout-template', order: 1, mobile: 'UI' },
      { id: '3', label: 'Graphic Design', path: '/graphic-design', icon: 'pen-tool', order: 2, mobile: 'Graphic' },
      { id: '4', label: 'Photos', path: '/photos', icon: 'camera', order: 3, mobile: 'Photos' },
      { id: '5', label: 'Blog', path: '/blog', icon: 'pen-tool', order: 4, mobile: 'Blog' },
    ];
  }

  return items.map((item: any) => ({
    id: item.sys.id,
    label: item.fields.label || '',
    path: item.fields.path || '',
    icon: item.fields.icon || 'home',
    order: item.fields.order || 0,
    mobile: item.fields.mobile || undefined,
  }));
};

// Blog Posts
export const getBlogPosts = async (options?: { skipCache?: boolean }): Promise<BlogPost[]> => {
  const items = await fetchWithCache(
    async () => {
      const response = await client.getEntries({
        content_type: 'blogPost',
        order: ['-fields.publishDate'],
        include: 2,
      });
      return { items: response.items };
    },
    {
      contentType: 'blogPost',
      maxAge: 5 * 60 * 1000, // 5 分钟缓存
      skipCache: options?.skipCache,
    }
  );

  return items.map((item: any) => ({
    id: item.sys.id,
    title: item.fields.title || '',
    slug: item.fields.slug || '',
    excerpt: item.fields.excerpt || '',
    content: item.fields.content || '',
    coverImage: getImageUrl(item.fields.coverImage),
    author: item.fields.author || 'Alex',
    publishDate: item.fields.publishDate || '',
    readTime: item.fields.readTime || '5 min read',
    tags: item.fields.tags || [],
    category: item.fields.category || 'Design',
  }));
};

export const getBlogPostBySlug = async (slug: string, options?: { skipCache?: boolean }): Promise<BlogPost | null> => {
  return fetchSingleWithCache(
    async () => {
      try {
        const response = await client.getEntries({
          content_type: 'blogPost',
          'fields.slug': slug,
          include: 2,
          limit: 1,
        });
        if (response.items.length === 0) return null;
        const item = response.items[0];
        return {
          id: item.sys.id,
          title: item.fields.title || '',
          slug: item.fields.slug || '',
          excerpt: item.fields.excerpt || '',
          content: item.fields.content || '',
          coverImage: getImageUrl(item.fields.coverImage),
          author: item.fields.author || 'Alex',
          publishDate: item.fields.publishDate || '',
          readTime: item.fields.readTime || '5 min read',
          tags: item.fields.tags || [],
          category: item.fields.category || 'Design',
        };
      } catch {
        return null;
      }
    },
    {
      contentType: 'blogPost',
      queryKey: slug,
      maxAge: 10 * 60 * 1000, // 10 分钟缓存
      skipCache: options?.skipCache,
    }
  );
};

// 强制刷新所有数据（用于手动刷新）
export const refreshAllData = async (): Promise<void> => {
  clearAllContentfulCache();
  console.log('[Cache] All cache cleared');
};
